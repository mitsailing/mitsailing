import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventDateAggregate: vi.fn(),
  eventDateFindMany: vi.fn(),
  eventRegistrationCount: vi.fn(),
  eventRegistrationFindFirst: vi.fn(),
  eventRegistrationFindMany: vi.fn(),
  eventCategoryFindMany: vi.fn(),
  getZenStack: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('react', () => ({
  cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
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
      findMany: mocks.eventRegistrationFindMany,
    },
  },
}));

vi.mock('@/libs/zenstack/auth', () => ({
  getZenStack: mocks.getZenStack,
  zenstackForAuthContext: mocks.zenstackForAuthContext,
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
  mocks.eventFindMany.mockReset();
  mocks.eventDateAggregate.mockReset();
  mocks.eventDateFindMany.mockReset();
  mocks.eventRegistrationCount.mockReset();
  mocks.eventRegistrationFindFirst.mockReset();
  mocks.eventRegistrationFindMany.mockReset();
  mocks.eventCategoryFindMany.mockReset();
  mocks.getZenStack.mockReset();
  mocks.zenstackForAuthContext.mockReset();
  mocks.getZenStack.mockReturnValue({
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
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
      findMany: mocks.eventRegistrationFindMany,
    },
  });
  mocks.zenstackForAuthContext.mockReturnValue({
    eventRegistration: {
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

  it('returns null without registration counts when no public event is found', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { getPublishedEventForPublicBySlug } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await getPublishedEventForPublicBySlug('missing');

    expect(result).toBeNull();
    expect(mocks.eventRegistrationCount).not.toHaveBeenCalled();
  });

  it('returns public event detail with normalized questions and status counts', async () => {
    const startDateTime = new Date('2026-06-01T13:00:00Z');
    const endDateTime = new Date('2026-06-01T16:00:00Z');
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      shortName: 'Intro',
      description: 'Learn.',
      slug: 'intro-sail',
      isSpecial: false,
      maxParticipants: 12,
      requiresApproval: true,
      requiresPhone: true,
      registrationStart: null,
      registrationEnd: null,
      detailPageKind: 'standard',
      externalDetailUrl: null,
      registrationMode: 'external',
      externalRegistrationUrl: 'https://example.com/register',
      externalEntriesUrl: 'https://example.com/entries',
      addressPreset: 'pavilion',
      addressName: '',
      addressLine1: '',
      addressLine2: null,
      addressCity: '',
      addressState: null,
      addressPostalCode: null,
      addressCountry: null,
      faqContent: '<p>Hidden FAQ</p>',
      faqVisible: false,
      isPublished: true,
      usesTeamRegistration: true,
      boatsPerTeam: 1,
      personsPerBoat: 2,
      allowRepeatTeamCaptain: false,
      category: { name: 'Classes' },
      dates: [{ id: 'date-1', startDateTime, endDateTime }],
      admins: [
        {
          id: 'event-admin-1',
          admin: {
            id: 'admin-1',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
          },
        },
        {
          id: 'event-admin-2',
          admin: {
            id: 'admin-2',
            name: 'Grace Hopper',
            email: 'grace@example.com',
          },
        },
      ],
      registrationQuestions: [
        {
          id: 'question-1',
          questionText: 'Diet?',
          answerType: 'select',
          options: ['Vegetarian', 3, 'Vegan'],
          required: true,
          displayOrder: 1,
        },
      ],
      entryFees: [
        {
          id: 'fee-1',
          description: 'Clinic fee',
          amountCents: 1550,
          isDeposit: false,
        },
      ],
    });
    mocks.eventRegistrationCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(2);
    mocks.eventRegistrationFindMany.mockResolvedValue([
      {
        id: 'registration-approved',
        status: EventRegistrationStatus.approved,
        user: { image: '/ada.jpg', name: 'Ada Lovelace' },
      },
      {
        id: 'registration-pending',
        status: EventRegistrationStatus.pending,
        user: { image: null, name: 'Alan Turing' },
      },
    ]);
    const { getPublishedEventForPublicBySlug } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await getPublishedEventForPublicBySlug('intro-sail');

    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          admins: {
            orderBy: [{ admin: { name: 'asc' } }, { admin: { email: 'asc' } }],
            select: {
              id: true,
              admin: { select: { id: true, name: true, email: true } },
            },
          },
          externalEntriesUrl: true,
          externalRegistrationUrl: true,
          addressPreset: true,
          registrationMode: true,
          usesTeamRegistration: true,
          boatsPerTeam: true,
          personsPerBoat: true,
          allowRepeatTeamCaptain: true,
          requiresPhone: true,
        }),
      })
    );
    expect(result?.admins).toEqual([
      {
        id: 'event-admin-1',
        admin: {
          id: 'admin-1',
          name: 'Ada Lovelace',
          email: 'ada@example.com',
        },
      },
      {
        id: 'event-admin-2',
        admin: {
          id: 'admin-2',
          name: 'Grace Hopper',
          email: 'grace@example.com',
        },
      },
    ]);
    expect(result?.approvedRegistrationCount).toBe(4);
    expect(result?.pendingRegistrationCount).toBe(2);
    expect(result?.addressName).toBe('MIT Sailing Pavilion');
    expect(result?.addressLine1).toBe('134 Memorial Drive');
    expect(result?.attendees).toEqual({
      approved: [
        {
          id: 'registration-approved',
          image: '/ada.jpg',
          name: 'Ada Lovelace',
        },
      ],
      pending: [
        {
          id: 'registration-pending',
          image: null,
          name: 'Alan Turing',
        },
      ],
    });
    expect(result).not.toHaveProperty('faqContent');
    expect(result).not.toHaveProperty('faqVisible');
    expect(result).not.toHaveProperty('isPublished');
    expect(result).toMatchObject({
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      registrationMode: 'external',
      requiresPhone: true,
      teamRegistration: {
        allowRepeatTeamCaptain: false,
        boatsPerTeam: 1,
        personsPerBoat: 2,
        usesTeamRegistration: true,
      },
    });
    expect(result?.registrationQuestions).toEqual([
      {
        id: 'question-1',
        questionText: 'Diet?',
        answerType: 'select',
        options: ['Vegetarian', 'Vegan'],
        required: true,
        displayOrder: 1,
      },
    ]);
    expect(mocks.eventRegistrationCount).toHaveBeenNthCalledWith(1, {
      where: { eventId: 'event-1', status: EventRegistrationStatus.approved },
    });
    expect(mocks.eventRegistrationCount).toHaveBeenNthCalledWith(2, {
      where: { eventId: 'event-1', status: EventRegistrationStatus.pending },
    });
    expect(mocks.eventRegistrationFindMany).toHaveBeenCalledWith({
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        status: true,
        user: { select: { image: true, name: true } },
      },
      where: {
        eventId: 'event-1',
        status: {
          in: [
            EventRegistrationStatus.approved,
            EventRegistrationStatus.pending,
          ],
        },
      },
    });
  });

  it('returns visible non-empty public content sections in legacy order', async () => {
    mocks.eventFindFirst.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      shortName: 'Intro',
      description: '',
      slug: 'intro-sail',
      isSpecial: false,
      maxParticipants: 12,
      requiresApproval: true,
      requiresPhone: false,
      registrationStart: null,
      registrationEnd: null,
      detailPageKind: 'standard',
      externalDetailUrl: null,
      addressPreset: 'custom',
      addressName: null,
      addressLine1: null,
      addressLine2: null,
      addressCity: null,
      addressState: null,
      addressPostalCode: null,
      addressCountry: null,
      faqContent: '<p>Questions</p>',
      faqVisible: true,
      noticeOfRaceContent: '<p>Notice</p>',
      noticeOfRaceVisible: true,
      sailingInstructionsContent: '<p>Hidden draft</p>',
      sailingInstructionsVisible: false,
      resultsContent: '   ',
      resultsVisible: true,
      category: { name: 'Classes' },
      dates: [],
      admins: [],
      registrationQuestions: [],
      entryFees: [],
    });
    mocks.eventRegistrationCount.mockResolvedValue(0);
    mocks.eventRegistrationFindMany.mockResolvedValue([]);
    const { getPublishedEventForPublicBySlug } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await getPublishedEventForPublicBySlug('intro-sail');

    expect(result?.publicContentSections).toEqual([
      {
        body: '<p>Questions</p>',
        id: 'faq',
        titleKey: 'content_faq_title',
      },
      {
        body: '<p>Notice</p>',
        id: 'noticeOfRace',
        titleKey: 'content_notice_of_race_title',
      },
    ]);
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

    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: 'user',
      id: 'user-1',
    });
    expect(mocks.eventRegistrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'event-1' },
      })
    );
  });

  it('returns null when no viewer registration is visible', async () => {
    mocks.eventRegistrationFindFirst.mockResolvedValue(null);
    const { getPublicEventRegistrationState } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await getPublicEventRegistrationState({
      eventId: 'event-1',
      userId: 'user-1',
    });

    expect(result).toBeNull();
  });
});

describe('listPublishedEventDatesForCalendarMonth', () => {
  const rangeStart = new Date('2026-06-01T04:00:00Z');
  const rangeEndExclusive = new Date('2026-07-01T04:00:00Z');

  it('returns empty dates without querying event dates when no public events exist', async () => {
    mocks.eventFindMany.mockResolvedValue([]);
    const { listPublishedEventDatesForCalendarMonth } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await listPublishedEventDatesForCalendarMonth({
      rangeEndExclusive,
      rangeStart,
    });

    expect(result).toEqual([]);
    expect(mocks.eventDateFindMany).not.toHaveBeenCalled();
  });

  it('returns public event dates with resolved category accent classes', async () => {
    const startDateTime = new Date('2026-06-01T13:00:00Z');
    const endDateTime = new Date('2026-06-01T16:00:00Z');
    mocks.eventFindMany.mockResolvedValue([{ id: 'event-1' }]);
    mocks.eventDateFindMany.mockResolvedValue([
      {
        id: 'date-1',
        startDateTime,
        endDateTime,
        event: {
          id: 'event-1',
          name: 'Intro Sail',
          slug: 'intro-sail',
          eventCategoryId: 'category-1',
          category: {
            id: 'category-1',
            name: 'Classes',
            accentClassName: 'emerald',
          },
        },
      },
    ]);
    const { listPublishedEventDatesForCalendarMonth } =
      await import('@/libs/mit-sailing/eventQueries');

    const result = await listPublishedEventDatesForCalendarMonth({
      categoryId: 'category-1',
      rangeEndExclusive,
      rangeStart,
    });

    expect(mocks.eventDateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: { in: ['event-1'] },
          event: expect.objectContaining({
            eventCategoryId: 'category-1',
          }),
        }),
      })
    );
    expect(result).toEqual([
      {
        id: 'date-1',
        startDateTime,
        endDateTime,
        event: {
          id: 'event-1',
          name: 'Intro Sail',
          slug: 'intro-sail',
          eventCategoryId: 'category-1',
          category: {
            id: 'category-1',
            name: 'Classes',
            accentClassName: 'emerald',
          },
        },
      },
    ]);
  });
});
