import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventDateAggregate: vi.fn(),
  eventDateFindMany: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventCategoryFindMany: vi.fn(),
  getZenStack: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventDate: {
      aggregate: mocks.eventDateAggregate,
      findMany: mocks.eventDateFindMany,
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

vi.mock('@/libs/zenstack/auth', () => ({
  getZenStack: mocks.getZenStack,
  zenstackForAuthContext: mocks.getZenStack,
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
  mocks.eventDateAggregate.mockReset();
  mocks.eventDateFindMany.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventCategoryFindMany.mockReset();
  mocks.getZenStack.mockReset();
  mocks.getZenStack.mockReturnValue({
    event: {
      findFirst: mocks.eventFindFirst,
    },
    eventCategory: {
      findMany: mocks.eventCategoryFindMany,
    },
    eventDate: {
      aggregate: mocks.eventDateAggregate,
      findMany: mocks.eventDateFindMany,
    },
    eventRegistration: {
      count: mocks.eventRegistrationCount,
      findFirst: mocks.eventRegistrationFindFirst,
    },
  });
});

describe('getPublishedEventForPublicBySlug', () => {
  it('loads public event detail through ZenStack policies', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { getPublishedEventForPublicBySlug } =
      await import('@/libs/mit-sailing/eventQueries');

    await getPublishedEventForPublicBySlug('intro-sail');

    expect(mocks.getZenStack).toHaveBeenCalled();
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'intro-sail' },
      })
    );
  });
});

describe('getPublicEventRegistrationState', () => {
  it('loads viewer registration state through ZenStack policies', async () => {
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

    expect(mocks.getZenStack).toHaveBeenCalled();
    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'event-1' },
      })
    );
  });
});
