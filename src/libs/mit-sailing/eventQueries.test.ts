import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventCategoryFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventCategory: {
      findMany: mocks.eventCategoryFindMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

beforeEach(() => {
  vi.resetModules();
  mocks.eventFindFirst.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventCategoryFindMany.mockReset();
});

describe('getPublicEventRegistrationState', () => {
  it('uses CASL event registration ownership for viewer registration lookup', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue({
      id: 'registration-1',
      status: 'pending',
    });
    const { getPublicEventRegistrationState } =
      await import('@/libs/mit-sailing/eventQueries');

    await getPublicEventRegistrationState({
      eventId: 'event-1',
      userId: 'user-1',
    });

    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [{ eventId: 'event-1' }, { OR: [{ userId: 'user-1' }] }],
        },
      })
    );
  });
});
