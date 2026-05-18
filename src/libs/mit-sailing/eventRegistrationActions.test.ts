import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindUnique: vi.fn(),
  eventRegistrationAnswerCreateMany: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationCreate: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventRegistrationUpdate: vi.fn(),
  eventRegistrationUpdateMany: vi.fn(),
  queryRaw: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
  unstable_rethrow: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    $transaction: mocks.transaction,
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventRegistration: {
      updateMany: mocks.eventRegistrationUpdateMany,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

function registrationFormData(): FormData {
  const formData = new FormData();
  formData.set('swimAgreementAccepted', 'true');
  return formData;
}

beforeEach(() => {
  mocks.eventFindFirst.mockReset();
  mocks.eventFindUnique.mockReset();
  mocks.eventRegistrationAnswerCreateMany.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationCreate.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventRegistrationUpdate.mockReset();
  mocks.eventRegistrationUpdateMany.mockReset();
  mocks.queryRaw.mockReset();
  mocks.redirect.mockClear();
  mocks.requireCurrentUser.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.transaction.mockReset();

  mocks.requireCurrentUser.mockResolvedValue({
    email: 'user@example.test',
    id: 'user-1',
    name: 'User One',
    role: Role.USER,
    unconfirmedEmail: null,
  });
  mocks.eventFindFirst.mockResolvedValue({
    id: 'event-1',
    registrationEnd: null,
    registrationQuestions: [],
    registrationStart: null,
  });
  mocks.eventFindUnique.mockResolvedValue({
    id: 'event-1',
    isPublished: true,
    maxParticipants: null,
    registrationEnd: null,
    registrationStart: null,
    requiresApproval: true,
  });
  mocks.eventRegistrationFindFirst.mockResolvedValue({
    id: 'registration-1',
  });
  mocks.eventRegistrationUpdate.mockResolvedValue({
    id: 'registration-1',
  });
  mocks.eventRegistrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(
    async (
      transactionOperation: (client: {
        $queryRaw: typeof mocks.queryRaw;
        event: {
          findUnique: typeof mocks.eventFindUnique;
        };
        eventRegistration: {
          count: typeof mocks.eventRegistrationCount;
          create: typeof mocks.eventRegistrationCreate;
          findFirst: typeof mocks.eventRegistrationFindFirst;
          update: typeof mocks.eventRegistrationUpdate;
        };
        eventRegistrationAnswer: {
          createMany: typeof mocks.eventRegistrationAnswerCreateMany;
        };
      }) => Promise<unknown>
    ) => {
      const result = await transactionOperation({
        $queryRaw: mocks.queryRaw,
        event: {
          findUnique: mocks.eventFindUnique,
        },
        eventRegistration: {
          count: mocks.eventRegistrationCount,
          create: mocks.eventRegistrationCreate,
          findFirst: mocks.eventRegistrationFindFirst,
          update: mocks.eventRegistrationUpdate,
        },
        eventRegistrationAnswer: {
          createMany: mocks.eventRegistrationAnswerCreateMany,
        },
      });
      return result;
    }
  );
});

describe('createPublicEventRegistrationAction', () => {
  it('uses CASL event registration ownership when loading the viewer registration', async () => {
    const { createPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      createPublicEventRegistrationAction(
        'en',
        'intro-sail',
        {
          code: null,
          fieldErrors: {},
          status: 'idle',
          values: {},
        },
        registrationFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'user-1' }] }],
        },
      })
    );
  });

  it('uses viewer ownership for admins on public registration', async () => {
    mocks.requireCurrentUser.mockResolvedValue({
      email: 'admin@example.test',
      id: 'admin-1',
      name: 'Admin One',
      role: Role.ADMIN,
      unconfirmedEmail: null,
    });
    const { createPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      createPublicEventRegistrationAction(
        'en',
        'intro-sail',
        {
          code: null,
          fieldErrors: {},
          status: 'idle',
          values: {},
        },
        registrationFormData()
      )
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'admin-1' }] }],
        },
      })
    );
  });
});

describe('cancelPublicEventRegistrationAction', () => {
  it('uses CASL event registration ownership when cancelling registrations', async () => {
    const { cancelPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      cancelPublicEventRegistrationAction('en', 'intro-sail')
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: {
        AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'user-1' }] }],
      },
    });
  });

  it('uses viewer ownership for admins when cancelling public registrations', async () => {
    mocks.requireCurrentUser.mockResolvedValue({
      email: 'admin@example.test',
      id: 'admin-1',
      name: 'Admin One',
      role: Role.ADMIN,
      unconfirmedEmail: null,
    });
    const { cancelPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      cancelPublicEventRegistrationAction('en', 'intro-sail')
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: {
        AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'admin-1' }] }],
      },
    });
  });
});
