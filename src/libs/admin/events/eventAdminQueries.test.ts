import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';
import type * as EventQueries from '@/libs/mit-sailing/eventQueries';

const mocks = vi.hoisted(() => ({
  eventFindFirst: vi.fn(),
  eventFindMany: vi.fn(),
  eventFindUnique: vi.fn(),
  eventRegistrationGroupBy: vi.fn(),
  protectedEventFindFirst: vi.fn(),
  protectedEventFindMany: vi.fn(),
  eventCategoryFindMany: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      findFirst: mocks.eventFindFirst,
      findMany: mocks.eventFindMany,
      findUnique: mocks.eventFindUnique,
    },
    eventCategory: {
      findMany: mocks.eventCategoryFindMany,
    },
    eventRegistration: {
      groupBy: mocks.eventRegistrationGroupBy,
    },
    user: {
      findMany: mocks.userFindMany,
    },
  },
}));

vi.mock('@/libs/mit-sailing/eventQueries', async (importOriginal) => ({
  ...(await importOriginal<typeof EventQueries>()),
  questionOptionsFromJson: (value: unknown) =>
    Array.isArray(value)
      ? value.filter((option): option is string => typeof option === 'string')
      : [],
}));

beforeEach(() => {
  mocks.eventFindFirst.mockReset();
  mocks.eventFindMany.mockReset();
  mocks.eventFindUnique.mockReset();
  mocks.eventRegistrationGroupBy.mockReset();
  mocks.protectedEventFindFirst.mockReset();
  mocks.protectedEventFindMany.mockReset();
  mocks.eventCategoryFindMany.mockReset();
  mocks.userFindMany.mockReset();
  mocks.eventCategoryFindMany.mockResolvedValue([]);
  mocks.eventRegistrationGroupBy.mockResolvedValue([]);
  mocks.userFindMany.mockResolvedValue([]);
});

describe('event admin queries', () => {
  const db = {
    event: {
      findFirst: mocks.protectedEventFindFirst,
      findMany: mocks.protectedEventFindMany,
    },
  };

  it('defaults event lists to my assigned events', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        admins: [],
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
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    const rows = await listAdminEventRows({
      authContext: { appRole: Role.DOCK_STAFF, id: 'staff-1' },
      query: 'intro',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]?.accessMode).toBe('editable');
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          admins: { some: { adminUserId: 'staff-1' } },
        }),
      })
    );
  });

  it('lists all admin-visible events with access modes', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        admins: [{ adminUserId: 'staff-1' }],
        id: 'event-1',
        name: 'Assigned Sail',
        shortName: 'Assigned',
        slug: 'assigned-sail',
        isPublished: true,
        isSpecial: false,
        maxParticipants: null,
        requiresApproval: false,
        detailPageKind: 'standard',
        category: { id: 'category-1', name: 'Classes' },
        dates: [],
      },
      {
        admins: [{ adminUserId: 'staff-2' }],
        id: 'event-2',
        name: 'Other Sail',
        shortName: 'Other',
        slug: 'other-sail',
        isPublished: true,
        isSpecial: false,
        maxParticipants: null,
        requiresApproval: false,
        detailPageKind: 'standard',
        category: { id: 'category-1', name: 'Classes' },
        dates: [],
      },
    ]);
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    const rows = await listAdminEventRows({
      authContext: { appRole: Role.VOLUNTEER_INSTRUCTOR, id: 'staff-1' },
      scope: 'all',
    });

    expect(rows.map((row) => [row.id, row.accessMode])).toEqual([
      ['event-1', 'editable'],
      ['event-2', 'readOnly'],
    ]);
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      })
    );
  });

  it('treats invalid event list scope as my events', async () => {
    mocks.eventFindMany.mockResolvedValue([]);
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    await listAdminEventRows({
      authContext: { appRole: Role.VOLUNTEER_INSTRUCTOR, id: 'staff-1' },
      scope: 'invalid-scope',
    });

    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          admins: { some: { adminUserId: 'staff-1' } },
        },
      })
    );
  });

  it('does not list events for ordinary users', async () => {
    mocks.eventFindMany.mockResolvedValue([
      {
        admins: [],
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
    const { listAdminEventRows } =
      await import('@/libs/admin/events/eventAdminQueries');

    const rows = await listAdminEventRows({
      authContext: { appRole: Role.USER, id: 'staff-1' },
      query: 'intro',
    });

    expect(rows).toEqual([]);
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

  it('returns null editor data without loading the app-owned event row', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue(null);
    mocks.eventCategoryFindMany.mockResolvedValue([
      { id: 'category-1', name: 'Classes' },
    ]);
    mocks.userFindMany.mockResolvedValue([
      { id: 'staff-1', name: 'Staff', email: 'staff@example.com' },
    ]);
    const { getAdminEventEditorDataBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventEditorDataBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(result).toEqual({
      categories: [{ id: 'category-1', name: 'Classes' }],
      event: null,
      users: [{ id: 'staff-1', name: 'Staff', email: 'staff@example.com' }],
    });
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it('limits assignable event admin users to staff and instructor roles', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue(null);
    const { getAdminEventEditorDataBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    await getAdminEventEditorDataBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appRole: {
            in: [
              Role.VOLUNTEER_INSTRUCTOR,
              Role.DOCK_STAFF,
              Role.DOCK_MASTER,
              Role.ADMIN,
            ],
          },
        },
      })
    );
  });

  it('returns only already-selected users for short event admin searches', async () => {
    const { listAdminEventUsers } =
      await import('@/libs/admin/events/eventAdminQueries');

    await listAdminEventUsers({
      query: 'a',
      selectedUserIds: ['selected-1', 'selected-2'],
    });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          appRole: {
            in: [
              Role.VOLUNTEER_INSTRUCTOR,
              Role.DOCK_STAFF,
              Role.DOCK_MASTER,
              Role.ADMIN,
            ],
          },
          id: { in: ['selected-1', 'selected-2'] },
        },
      })
    );
  });

  it('keeps already-selected users visible during event admin searches', async () => {
    const { listAdminEventUsers } =
      await import('@/libs/admin/events/eventAdminQueries');

    await listAdminEventUsers({
      query: 'alex',
      selectedUserIds: ['selected-1'],
    });

    expect(mocks.userFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            {
              appRole: {
                in: [
                  Role.VOLUNTEER_INSTRUCTOR,
                  Role.DOCK_STAFF,
                  Role.DOCK_MASTER,
                  Role.ADMIN,
                ],
              },
            },
            {
              OR: [
                { id: { in: ['selected-1'] } },
                { name: { contains: 'alex', mode: 'insensitive' } },
                { email: { contains: 'alex', mode: 'insensitive' } },
              ],
            },
          ],
        },
      })
    );
  });

  it('returns editor data with normalized questions and registration counts', async () => {
    const createdAt = new Date('2026-05-01T12:00:00Z');
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      shortName: 'Intro',
      slug: 'intro-sail',
      eventCategoryId: 'category-1',
      description: 'Learn.',
      isSpecial: false,
      maxParticipants: 12,
      requiresApproval: true,
      requiresPhone: true,
      registrationStart: null,
      registrationEnd: null,
      createdAt,
      detailPageKind: 'standard',
      externalDetailUrl: null,
      registrationMode: 'external',
      externalRegistrationUrl: 'https://example.com/register',
      externalEntriesUrl: 'https://example.com/entries',
      usesTeamRegistration: true,
      boatsPerTeam: 2,
      personsPerBoat: 1,
      allowRepeatTeamCaptain: true,
      isPublished: true,
      dates: [],
      admins: [],
      registrationQuestions: [
        {
          id: 'question-1',
          questionText: 'Diet?',
          answerType: 'select',
          options: ['Vegetarian', 7, 'Vegan'],
          required: true,
          displayOrder: 1,
        },
      ],
      entryFees: [],
    });
    mocks.eventRegistrationGroupBy.mockResolvedValue([
      { status: EventRegistrationStatus.pending, _count: { id: 2 } },
      { status: EventRegistrationStatus.approved, _count: { id: 3 } },
    ]);
    const { getAdminEventEditorDataBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventEditorDataBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(result.event?.registrationQuestions).toEqual([
      {
        id: 'question-1',
        questionText: 'Diet?',
        answerType: 'select',
        options: ['Vegetarian', 'Vegan'],
        required: true,
        displayOrder: 1,
      },
    ]);
    expect(result.event?.registrationCounts).toEqual({
      approved: 3,
      cancelled: 0,
      pending: 2,
    });
    expect(mocks.eventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          externalEntriesUrl: true,
          externalRegistrationUrl: true,
          registrationMode: true,
          requiresPhone: true,
          usesTeamRegistration: true,
          boatsPerTeam: true,
          personsPerBoat: true,
          allowRepeatTeamCaptain: true,
        }),
      })
    );
    expect(result.event).toMatchObject({
      allowRepeatTeamCaptain: true,
      boatsPerTeam: 2,
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      personsPerBoat: 1,
      registrationMode: 'external',
      requiresPhone: true,
      usesTeamRegistration: true,
    });
  });

  it('returns null delete data when protected access cannot find the event', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue(null);
    const { getAdminEventDeleteBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventDeleteBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(result).toBeNull();
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it('returns delete counts from the app-owned event row', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      slug: 'intro-sail',
      _count: { registrations: 4, dates: 2 },
    });
    const { getAdminEventDeleteBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventDeleteBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(result).toEqual({
      dateCount: 2,
      id: 'event-1',
      name: 'Intro Sail',
      registrationCount: 4,
      slug: 'intro-sail',
    });
  });

  it('returns null registrations data when protected access cannot find the event', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue(null);
    const { getAdminEventRegistrationsBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventRegistrationsBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(result).toBeNull();
    expect(mocks.eventFindUnique).not.toHaveBeenCalled();
  });

  it('sorts registrations by status and date with sorted answers', async () => {
    const older = new Date('2026-05-01T12:00:00Z');
    const newer = new Date('2026-05-02T12:00:00Z');
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      slug: 'intro-sail',
      registrationQuestions: [
        {
          id: 'question-1',
          questionText: 'Diet?',
          answerType: 'select',
          options: ['Vegetarian'],
          required: false,
          displayOrder: 1,
        },
      ],
      registrations: [
        {
          id: 'cancelled-1',
          phone: null,
          status: EventRegistrationStatus.cancelled,
          createdAt: newer,
          swimAgreementAcceptedAt: newer,
          user: { id: 'user-1', name: 'A', email: 'a@example.com' },
          registrationTeam: null,
          boatMembers: [],
          registrationAnswers: [],
        },
        {
          id: 'pending-older',
          phone: null,
          status: EventRegistrationStatus.pending,
          createdAt: older,
          swimAgreementAcceptedAt: older,
          user: { id: 'user-2', name: 'B', email: 'b@example.com' },
          registrationTeam: null,
          boatMembers: [],
          registrationAnswers: [],
        },
        {
          id: 'pending-newer',
          phone: '617-555-0100',
          status: EventRegistrationStatus.pending,
          createdAt: newer,
          swimAgreementAcceptedAt: newer,
          user: { id: 'user-3', name: 'C', email: 'c@example.com' },
          registrationTeam: null,
          boatMembers: [],
          registrationAnswers: [
            {
              id: 'answer-2',
              value: 'second',
              question: {
                id: 'question-2',
                questionText: 'Second',
                displayOrder: 2,
              },
            },
            {
              id: 'answer-1',
              value: 'first',
              question: {
                id: 'question-1',
                questionText: 'First',
                displayOrder: 1,
              },
            },
          ],
        },
      ],
    });
    mocks.eventRegistrationGroupBy.mockResolvedValue([
      { status: EventRegistrationStatus.cancelled, _count: { id: 1 } },
      { status: EventRegistrationStatus.pending, _count: { id: 2 } },
    ]);
    const { getAdminEventRegistrationsBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventRegistrationsBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(
      result?.registrations.map((registration) => registration.id)
    ).toEqual(['pending-newer', 'pending-older', 'cancelled-1']);
    expect(
      result?.registrations[0]?.answers.map((answer) => answer.id)
    ).toEqual(['answer-1', 'answer-2']);
    expect(result?.registrations[0]?.phone).toBe('617-555-0100');
    expect(result?.registrationCounts).toEqual({
      approved: 0,
      cancelled: 1,
      pending: 2,
    });
  });

  it('selects and maps registration team and boat data', async () => {
    const createdAt = new Date('2026-05-02T12:00:00Z');
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      requiresPhone: false,
      slug: 'intro-sail',
      registrationQuestions: [],
      entryFees: [],
      registrations: [
        {
          id: 'registration-1',
          phone: null,
          status: EventRegistrationStatus.pending,
          createdAt,
          swimAgreementAcceptedAt: createdAt,
          user: {
            id: 'user-1',
            name: 'Captain One',
            email: 'captain@example.com',
          },
          registrationTeam: { id: 'team-1', teamName: 'Fast Team' },
          boatMembers: [
            {
              id: 'member-crew',
              boatNumber: 1,
              position: 1,
              fullName: 'Crew One',
              email: 'crew@example.com',
            },
            {
              id: 'member-helm',
              boatNumber: 1,
              position: 0,
              fullName: 'Helm One',
              email: 'helm@example.com',
            },
          ],
          registrationAnswers: [],
        },
      ],
    });
    const { getAdminEventRegistrationsBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventRegistrationsBySlug({
      db,
      slug: 'intro-sail',
    });

    expect(mocks.eventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          registrations: expect.objectContaining({
            select: expect.objectContaining({
              boatMembers: expect.objectContaining({
                orderBy: [{ boatNumber: 'asc' }, { position: 'asc' }],
              }),
              registrationTeam: expect.any(Object),
            }),
          }),
        }),
      })
    );
    expect(result?.registrations[0]).toMatchObject({
      registrationTeam: {
        id: 'team-1',
        teamName: 'Fast Team',
      },
      boatMembers: [
        {
          id: 'member-helm',
          boatNumber: 1,
          position: 0,
          positionLabel: 'helm',
          fullName: 'Helm One',
          email: 'helm@example.com',
        },
        {
          id: 'member-crew',
          boatNumber: 1,
          position: 1,
          positionLabel: 'crew',
          fullName: 'Crew One',
          email: 'crew@example.com',
        },
      ],
    });
  });

  it('returns show data with summary content and registration review', async () => {
    const startDateTime = new Date('2026-06-01T13:00:00Z');
    const endDateTime = new Date('2026-06-01T15:00:00Z');
    const registrationStart = new Date('2026-05-01T04:00:00Z');
    const registrationEnd = new Date('2026-05-31T04:00:00Z');
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      admins: [
        {
          admin: {
            email: 'instructor@example.com',
            id: 'instructor-1',
            name: 'Sailing Instructor',
          },
          adminUserId: 'instructor-1',
          id: 'event-admin-1',
        },
      ],
      category: { id: 'category-1', name: 'Clinic' },
      dates: [{ id: 'date-1', startDateTime, endDateTime }],
      description: 'Learn how to sail.',
      detailPageKind: 'standard',
      externalDetailUrl: null,
      registrationMode: 'external',
      externalRegistrationUrl: 'https://example.com/register',
      externalEntriesUrl: 'https://example.com/entries',
      usesTeamRegistration: true,
      boatsPerTeam: 1,
      personsPerBoat: 2,
      allowRepeatTeamCaptain: false,
      id: 'event-1',
      isPublished: true,
      isSpecial: false,
      maxParticipants: 12,
      name: 'Intro Sail',
      registrationEnd,
      registrationQuestions: [
        {
          answerType: 'text',
          displayOrder: 1,
          id: 'question-1',
          options: null,
          questionText: 'Dietary restrictions?',
          required: false,
        },
      ],
      registrationStart,
      registrations: [
        {
          createdAt: startDateTime,
          id: 'registration-1',
          phone: '617-555-0199',
          registrationAnswers: [
            {
              id: 'answer-1',
              question: {
                displayOrder: 1,
                id: 'question-1',
                questionText: 'Dietary restrictions?',
              },
              value: 'Vegetarian',
            },
          ],
          status: EventRegistrationStatus.pending,
          swimAgreementAcceptedAt: startDateTime,
          registrationTeam: { id: 'team-1', teamName: 'Fast Team' },
          boatMembers: [
            {
              id: 'member-1',
              boatNumber: 1,
              position: 0,
              fullName: 'Helm One',
              email: 'helm@example.com',
            },
          ],
          user: {
            email: 'sailor@example.com',
            id: 'user-1',
            name: 'Sailor One',
          },
        },
      ],
      requiresApproval: true,
      requiresPhone: true,
      shortName: 'Intro',
      slug: 'intro-sail',
    });
    mocks.eventRegistrationGroupBy.mockResolvedValue([
      { status: EventRegistrationStatus.approved, _count: { id: 3 } },
      { status: EventRegistrationStatus.pending, _count: { id: 2 } },
    ]);
    const { getAdminEventShowBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventShowBySlug({
      accessMode: 'editable',
      db,
      slug: 'intro-sail',
    });

    expect(result).toMatchObject({
      accessMode: 'editable',
      description: 'Learn how to sail.',
      detailPageKind: 'standard',
      externalEntriesUrl: 'https://example.com/entries',
      externalRegistrationUrl: 'https://example.com/register',
      id: 'event-1',
      boatsPerTeam: 1,
      maxParticipants: 12,
      name: 'Intro Sail',
      personsPerBoat: 2,
      publicContentSections: [
        {
          body: '<p>Learn how to sail.</p>',
          id: 'description',
          titleKey: 'content_description_title',
        },
      ],
      registrationMode: 'external',
      requiresPhone: true,
      usesTeamRegistration: true,
      registrationCounts: {
        approved: 3,
        cancelled: 0,
        pending: 2,
      },
      slug: 'intro-sail',
    });
    expect(mocks.eventFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          externalEntriesUrl: true,
          externalRegistrationUrl: true,
          registrationMode: true,
          requiresPhone: true,
          usesTeamRegistration: true,
          boatsPerTeam: true,
          personsPerBoat: true,
          allowRepeatTeamCaptain: true,
        }),
      })
    );
    expect(
      result?.registrations.map((registration) => registration.id)
    ).toEqual(['registration-1']);
    expect(result?.registrations[0]?.registrationTeam?.teamName).toBe(
      'Fast Team'
    );
    expect(result?.registrations[0]?.boatMembers[0]?.fullName).toBe('Helm One');
    expect(result?.questions.map((question) => question.id)).toEqual([
      'question-1',
    ]);
  });

  it('returns visible non-empty public content sections in legacy order', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      admins: [],
      category: { id: 'category-1', name: 'Clinic' },
      dates: [],
      description: '',
      detailPageKind: 'standard',
      externalDetailUrl: null,
      faqContent: '<p>Questions</p>',
      faqVisible: true,
      id: 'event-1',
      isPublished: true,
      isSpecial: false,
      maxParticipants: null,
      name: 'Intro Sail',
      noticeOfRaceContent: '<p>Notice</p>',
      noticeOfRaceVisible: true,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
      registrations: [],
      requiresApproval: false,
      requiresPhone: false,
      resultsContent: '<p>Scores</p>',
      resultsVisible: true,
      sailingInstructionsContent: '<p>Hidden draft</p>',
      sailingInstructionsVisible: false,
      shortName: 'Intro',
      slug: 'intro-sail',
    });
    const { getAdminEventShowBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventShowBySlug({
      accessMode: 'editable',
      db,
      slug: 'intro-sail',
    });

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
      {
        body: '<p>Scores</p>',
        id: 'results',
        titleKey: 'content_results_title',
      },
    ]);
  });

  it('sanitizes description public content before returning admin show data', async () => {
    mocks.protectedEventFindFirst.mockResolvedValue({ id: 'event-1' });
    mocks.eventFindUnique.mockResolvedValue({
      admins: [],
      category: { id: 'category-1', name: 'Clinic' },
      dates: [],
      description:
        '<p>Learn <strong>fast</strong>.</p><script>alert("x")</script><a href="javascript:alert(1)">bad link</a>',
      detailPageKind: 'standard',
      externalDetailUrl: null,
      externalEntriesUrl: null,
      externalRegistrationUrl: null,
      faqContent: '',
      faqVisible: false,
      id: 'event-1',
      isPublished: true,
      isSpecial: false,
      maxParticipants: null,
      name: 'Intro Sail',
      noticeOfRaceContent: '',
      noticeOfRaceVisible: false,
      registrationEnd: null,
      registrationQuestions: [],
      registrationStart: null,
      registrations: [],
      requiresApproval: false,
      requiresPhone: false,
      resultsContent: '',
      resultsVisible: false,
      sailingInstructionsContent: '',
      sailingInstructionsVisible: false,
      shortName: 'Intro',
      slug: 'intro-sail',
    });
    const { getAdminEventShowBySlug } =
      await import('@/libs/admin/events/eventAdminQueries');

    const result = await getAdminEventShowBySlug({
      accessMode: 'editable',
      db,
      slug: 'intro-sail',
    });

    expect(result?.publicContentSections).toEqual([
      {
        body: '<p>Learn <strong>fast</strong>.</p>bad link',
        id: 'description',
        titleKey: 'content_description_title',
      },
    ]);
  });
});
