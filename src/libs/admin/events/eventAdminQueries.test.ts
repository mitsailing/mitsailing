import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventRegistrationGroupBy: vi.fn(),
  protectedEventFindFirst: vi.fn(),
  protectedEventFindMany: vi.fn(),
  protectedEventUpdateMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
    },
    eventCategory: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    eventRegistration: {
      groupBy: mocks.eventRegistrationGroupBy,
    },
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
  questionOptionsFromJson: (value: unknown) =>
    Array.isArray(value)
      ? value.filter((option): option is string => typeof option === 'string')
      : [],
}));

beforeEach(() => {
  mocks.eventFindFirst.mockReset();
  mocks.eventFindMany.mockReset();
  mocks.eventRegistrationGroupBy.mockReset();
  mocks.protectedEventFindFirst.mockReset();
  mocks.protectedEventFindMany.mockReset();
  mocks.protectedEventUpdateMany.mockReset();
  mocks.userFindMany.mockReset();
  mocks.eventRegistrationGroupBy.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

describe('event admin queries', () => {
  const db = {
    event: {
      findFirst: mocks.protectedEventFindFirst,
      findMany: mocks.protectedEventFindMany,
      updateMany: mocks.protectedEventUpdateMany,
    },
  };

  it('lists events after proving ZenStack update access', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Intro Sail',
        shortName: 'Intro',
        slug: 'intro-sail',
        isPublished: true,
        isSpecial: false,
        maxParticipants: null,
        requiresApproval: false,
        detailPageKind: 'standard',
        category: { id: 'category-1', name: 'Classes' },
        dates: [],
      },
    ]);
    mocks.protectedEventUpdateMany.mockResolvedValue({ count: 1 });
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    await listAdminEventRows({
      db,
      query: 'intro',
    });

    expect(mocks.protectedEventUpdateMany).toHaveBeenCalledWith({
      data: { slug: 'intro-sail' },
      where: { id: 'event-1' },
    });
  });

  it('does not list public-readable events without update access', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Intro Sail',
        shortName: 'Intro',
        slug: 'intro-sail',
        isPublished: true,
        isSpecial: false,
        maxParticipants: null,
        requiresApproval: false,
        detailPageKind: 'standard',
        category: { id: 'category-1', name: 'Classes' },
        dates: [],
      },
    ]);
    mocks.protectedEventFindMany.mockResolvedValue([{ id: 'event-1' }]);
    mocks.protectedEventUpdateMany.mockResolvedValue({ count: 0 });
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    const rows = await listAdminEventRows({
      db,
      query: 'intro',
    });

    expect(rows).toEqual([]);
    expect(mocks.protectedEventFindMany).not.toHaveBeenCalled();
  });

  it('loads editor data through the protected ZenStack client', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue(null);
    const { getAdminEventEditorDataBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    await getAdminEventEditorDataBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(mocks.protectedEventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { slug: 'intro-sail' },
        select: { id: true },
      })
    );
  });
});
