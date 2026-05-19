import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import { Role } from '@/libs/auth/roles';

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

vi.mock('@/libs/mit-sailing/eventQueries', () => ({
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

  it('lists events after proving update access without writes', async () => {
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
  });

  it('does not list public-readable events without update access', async () => {
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
      authContext: { appRole: Role.VOLUNTEER_INSTRUCTOR, id: 'staff-1' },
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
      registrationStart: null,
      registrationEnd: null,
      createdAt,
      detailPageKind: 'standard',
      externalDetailUrl: null,
      internalNotes: null,
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
          status: EventRegistrationStatus.cancelled,
          createdAt: newer,
          swimAgreementAcceptedAt: newer,
          user: { id: 'user-1', name: 'A', email: 'a@example.com' },
          registrationAnswers: [],
        },
        {
          id: 'pending-older',
          status: EventRegistrationStatus.pending,
          createdAt: older,
          swimAgreementAcceptedAt: older,
          user: { id: 'user-2', name: 'B', email: 'b@example.com' },
          registrationAnswers: [],
        },
        {
          id: 'pending-newer',
          status: EventRegistrationStatus.pending,
          createdAt: newer,
          swimAgreementAcceptedAt: newer,
          user: { id: 'user-3', name: 'C', email: 'c@example.com' },
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
    expect(result?.registrationCounts).toEqual({
      approved: 0,
      cancelled: 1,
      pending: 2,
    });
  });
});
