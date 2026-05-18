import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventRegistrationGroupBy: vi.fn(),
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
  mocks.userFindMany.mockReset();
  mocks.eventRegistrationGroupBy.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

describe('event admin queries', () => {
  const eventAccessWhere = {
    OR: [{ admins: { some: { adminUserId: 'instructor-1' } } }],
  };

  it('lists only events allowed by the CASL event access scope', async () => {
    mocks.eventFindMany.mockResolvedValue([]);
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    await listAdminEventRows({
      eventAccessWhere,
      query: 'intro',
    });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            eventAccessWhere,
            {
              OR: [
                { name: { contains: 'intro', mode: 'insensitive' } },
                { shortName: { contains: 'intro', mode: 'insensitive' } },
                { slug: { contains: 'intro', mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
    );
  });

  it('loads editor data through the CASL event access scope', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { getAdminEventEditorDataBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    await getAdminEventEditorDataBySlug({
      eventAccessWhere,
      slug: 'intro-sail',
    });

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ slug: 'intro-sail' }, eventAccessWhere] },
      })
    );
  });
});
