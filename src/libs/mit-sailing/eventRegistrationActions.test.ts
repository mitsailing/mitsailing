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
  appAuthContextFromSession: vi.fn(),
  requireCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  transaction: vi.fn(),
  verifySession: vi.fn(),
  zenstackForAuthContext: vi.fn(),
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
  verifySession: mocks.verifySession,
}));

vi.mock('@/libs/zenstack/authContext', () => ({
  appAuthContextFromSession: mocks.appAuthContextFromSession,
}));

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
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
  mocks.appAuthContextFromSession.mockReset();
  mocks.requireCurrentUser.mockReset();
  mocks.revalidatePath.mockClear();
  mocks.transaction.mockReset();
  mocks.verifySession.mockReset();
  mocks.zenstackForAuthContext.mockReset();

  const session = {
    session: { impersonatedBy: null },
    user: {
      appRole: Role.USER,
      banned: false,
      emailVerified: true,
      email: 'user@example.test',
      id: 'user-1',
      name: 'User One',
      role: Role.USER,
      unconfirmedEmail: null,
    },
  };
  mocks.verifySession.mockResolvedValue(session);
  mocks.appAuthContextFromSession.mockReturnValue({
    appRole: Role.USER,
    id: 'user-1',
  });
  mocks.requireCurrentUser.mockResolvedValue({
    email: 'user@example.test',
    id: 'user-1',
    name: 'User One',
    role: Role.USER,
    unconfirmedEmail: null,
  });
  mocks.eventFindFirst.mockResolvedValue({
    id: 'event-1',
    requiresPhone: false,
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
    requiresPhone: false,
  });
  mocks.eventRegistrationFindFirst.mockResolvedValue({
    id: 'registration-1',
  });
  mocks.eventRegistrationUpdate.mockResolvedValue({
    id: 'registration-1',
  });
  mocks.eventRegistrationUpdateMany.mockResolvedValue({ count: 1 });
  mocks.zenstackForAuthContext.mockReturnValue({
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventRegistration: {
      findFirst: mocks.eventRegistrationFindFirst,
    },
  });
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
  it('loads the viewer registration after locking the event', async () => {
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
        where: { eventId: 'event-1', userId: 'user-1' },
      })
    );
    expect(mocks.queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.eventRegistrationFindFirst.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('uses a user-scoped ZenStack context for admins on public registration', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        email: 'admin@example.test',
        id: 'admin-1',
        name: 'Admin One',
        role: Role.ADMIN,
        unconfirmedEmail: null,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.ADMIN,
      id: 'admin-1',
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

    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: Role.USER,
      id: 'admin-1',
    });
  });

  it('fails closed before loading events for banned or unverified users', async () => {
    mocks.appAuthContextFromSession.mockReturnValue(null);
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
    ).rejects.toThrow(
      'NEXT_REDIRECT:/events/intro-sail/register?registration=not_found'
    );

    expect(mocks.eventFindFirst).not.toHaveBeenCalled();
  });

  it('creates pending registration for approval-required event at accepted capacity', async () => {
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      isPublished: true,
      maxParticipants: 2,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: true,
      requiresPhone: false,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: 'registration-2',
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

    expect(mocks.eventRegistrationCount).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-1',
        status: EventRegistrationStatus.pending,
        userId: 'user-1',
      }),
    });
  });

  it('rejects auto-approved registration at accepted capacity', async () => {
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      isPublished: true,
      maxParticipants: 2,
      registrationEnd: null,
      registrationStart: null,
      requiresApproval: false,
      requiresPhone: false,
    });
    mocks.eventRegistrationCount.mockResolvedValue(2);
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
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
    ).rejects.toThrow(
      'NEXT_REDIRECT:/events/intro-sail/register?registration=full'
    );

    expect(mocks.eventRegistrationCount).toHaveBeenCalledWith({
      where: {
        eventId: 'event-1',
        status: EventRegistrationStatus.approved,
      },
    });
    expect(mocks.eventRegistrationCreate).not.toHaveBeenCalled();
    expect(mocks.eventRegistrationUpdate).not.toHaveBeenCalled();
  });

  it('returns validation state when required phone is blank', async () => {
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      requiresPhone: true,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
    });
    const formData = registrationFormData();
    formData.set('phone', '   ');
    const { createPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    const result = await createPublicEventRegistrationAction(
      'en',
      'intro-sail',
      {
        code: null,
        fieldErrors: {},
        status: 'idle',
        values: {},
      },
      formData
    );

    expect(result).toEqual({
      code: 'questions_required',
      fieldErrors: { phone: 'questions_required' },
      status: 'error',
      values: {
        phone: ['   '],
        swimAgreementAccepted: ['true'],
      },
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('creates required-phone registrations with trimmed phone', async () => {
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      requiresPhone: true,
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
      requiresPhone: true,
    });
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: 'registration-2',
    });
    const formData = registrationFormData();
    formData.set('phone', '  617-555-0100  ');
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
        formData
      )
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '617-555-0100',
      }),
    });
  });

  it('updates required-phone registrations with trimmed phone', async () => {
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      requiresPhone: true,
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
      requiresPhone: true,
    });
    const formData = registrationFormData();
    formData.set('phone', '  617-555-0111  ');
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
        formData
      )
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationUpdate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: '617-555-0111',
      }),
      where: { id: 'registration-1' },
    });
  });

  it('creates non-required-phone registrations with omitted phone', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    mocks.eventRegistrationCreate.mockResolvedValue({
      id: 'registration-2',
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

    expect(mocks.eventRegistrationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        phone: null,
      }),
    });
  });
});

describe('cancelPublicEventRegistrationAction', () => {
  it('cancels viewer registrations with explicit owner scope after ZenStack event access', async () => {
    const { cancelPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      cancelPublicEventRegistrationAction('en', 'intro-sail')
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: { eventId: 'event-1', userId: 'user-1' },
    });
  });

  it('uses viewer ownership for admins when cancelling public registrations', async () => {
    mocks.verifySession.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.ADMIN,
        banned: false,
        emailVerified: true,
        email: 'admin@example.test',
        id: 'admin-1',
        name: 'Admin One',
        role: Role.ADMIN,
        unconfirmedEmail: null,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.ADMIN,
      id: 'admin-1',
    });
    const { cancelPublicEventRegistrationAction } =
      await import('@/libs/mit-sailing/eventRegistrationActions');

    await expect(
      cancelPublicEventRegistrationAction('en', 'intro-sail')
    ).rejects.toThrow('NEXT_REDIRECT:/events/intro-sail');

    expect(mocks.eventRegistrationUpdateMany).toHaveBeenCalledWith({
      data: { status: EventRegistrationStatus.cancelled },
      where: { eventId: 'event-1', userId: 'admin-1' },
    });
  });
});
