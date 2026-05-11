import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { EventRegistrationStatus as EventRegistrationStatusValue } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';
import { questionOptionsFromJson } from '@/libs/mit-sailing/eventQueries';

export type AdminEventCategoryOption = {
  id: string;
  name: string;
};

export type AdminEventUserOption = {
  id: string;
  name: string;
  email: string;
};

export type AdminEventRegistrationCounts = {
  pending: number;
  approved: number;
  cancelled: number;
};

export type AdminEventDateDto = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
};

export type AdminEventListRow = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  isPublished: boolean;
  isSpecial: boolean;
  maxParticipants: number | null;
  requiresApproval: boolean;
  detailPageKind: 'standard' | 'external' | null;
  category: { id: string; name: string };
  dates: AdminEventDateDto[];
  registrationCounts: AdminEventRegistrationCounts;
};

export type AdminEventQuestionDto = {
  id: string;
  questionText: string;
  answerType: 'text' | 'select' | 'checkbox';
  options: string[];
  required: boolean;
  displayOrder: number;
};

export type AdminEventFeeDto = {
  id: string;
  description: string;
  /** USD minor units (integer cents); same as Stripe `amount` for `usd`. */
  amountCents: number;
  isDeposit: boolean;
};

export type AdminEventAdminDto = {
  id: string;
  adminUserId: string;
  admin: AdminEventUserOption;
};

export type AdminEventEditorDto = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  eventCategoryId: string;
  description: string;
  isSpecial: boolean;
  maxParticipants: number | null;
  requiresApproval: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  createdAt: Date;
  detailPageKind: 'standard' | 'external' | null;
  externalDetailUrl: string | null;
  internalNotes: string | null;
  isPublished: boolean;
  createdBy: AdminEventUserOption;
  dates: AdminEventDateDto[];
  admins: AdminEventAdminDto[];
  registrationQuestions: AdminEventQuestionDto[];
  entryFees: AdminEventFeeDto[];
  registrationCounts: AdminEventRegistrationCounts;
};

export type AdminEventEditorData = {
  event: AdminEventEditorDto | null;
  categories: AdminEventCategoryOption[];
  users: AdminEventUserOption[];
};

export type AdminEventRegistrationAnswerDto = {
  id: string;
  value: string;
  question: {
    id: string;
    questionText: string;
    displayOrder: number;
  };
};

export type AdminEventRegistrationDto = {
  id: string;
  status: EventRegistrationStatusValue;
  createdAt: Date;
  swimAgreementAcceptedAt: Date;
  user: AdminEventUserOption;
  answers: AdminEventRegistrationAnswerDto[];
};

export type AdminEventRegistrationsDto = {
  id: string;
  name: string;
  slug: string;
  questions: AdminEventQuestionDto[];
  registrations: AdminEventRegistrationDto[];
  registrationCounts: AdminEventRegistrationCounts;
};

export type AdminEventListFilters = {
  query?: string;
  categoryId?: string;
};

type AdminEventUserListOptions = {
  limit?: number;
  offset?: number;
  query?: string;
};

const DEFAULT_ADMIN_EVENT_USER_LIMIT = 100;
const MAX_ADMIN_EVENT_USER_LIMIT = 200;

function emptyRegistrationCounts(): AdminEventRegistrationCounts {
  return { pending: 0, approved: 0, cancelled: 0 };
}

async function registrationCountsByEventId(
  eventIds: readonly string[]
): Promise<Map<string, AdminEventRegistrationCounts>> {
  if (eventIds.length === 0) {
    return new Map();
  }
  const eventIdList = [...eventIds];
  const rows = await prisma.eventRegistration.groupBy({
    by: ['eventId', 'status'],
    where: { eventId: { in: eventIdList } },
    _count: { id: true },
  });
  const counts = new Map<string, AdminEventRegistrationCounts>();
  for (const row of rows) {
    const existing = counts.get(row.eventId) ?? emptyRegistrationCounts();
    existing[row.status] = row._count.id ?? 0;
    counts.set(row.eventId, existing);
  }
  return counts;
}

async function registrationCountsForEventId(
  eventId: string
): Promise<AdminEventRegistrationCounts> {
  const rows = await prisma.eventRegistration.groupBy({
    by: ['status'],
    where: { eventId },
    _count: { id: true },
  });
  const counts = emptyRegistrationCounts();
  for (const row of rows) {
    counts[row.status] = row._count.id ?? 0;
  }
  return counts;
}

function questionFromDb(row: {
  id: string;
  questionText: string;
  answerType: 'text' | 'select' | 'checkbox';
  options: Prisma.JsonValue | null;
  required: boolean;
  displayOrder: number;
}): AdminEventQuestionDto {
  return {
    id: row.id,
    questionText: row.questionText,
    answerType: row.answerType,
    options: questionOptionsFromJson(row.options),
    required: row.required,
    displayOrder: row.displayOrder,
  };
}

function statusOrder(status: EventRegistrationStatusValue): number {
  if (status === EventRegistrationStatus.pending) {
    return 0;
  }
  if (status === EventRegistrationStatus.approved) {
    return 1;
  }
  return 2;
}

function compareRegistrations(
  a: AdminEventRegistrationDto,
  b: AdminEventRegistrationDto
): number {
  const byStatus = statusOrder(a.status) - statusOrder(b.status);
  if (byStatus !== 0) {
    return byStatus;
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function eventWhereFromFilters(
  filters: AdminEventListFilters
): Prisma.EventWhereInput {
  const where: Prisma.EventWhereInput = {};
  const query = filters.query?.trim();
  const categoryId = filters.categoryId?.trim();
  if (categoryId) {
    where.eventCategoryId = categoryId;
  }
  if (query) {
    where.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { shortName: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
    ];
  }
  return where;
}

export async function listAdminEventCategories(): Promise<
  AdminEventCategoryOption[]
> {
  const rows = await prisma.eventCategory.findMany({
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  });
  return rows;
}

function adminEventUserWhereFromOptions(
  options: AdminEventUserListOptions
): Prisma.UserWhereInput {
  const query = options.query?.trim();
  if (!query) {
    return {};
  }
  return {
    OR: [
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ],
  };
}

async function listAdminEventUsers(
  options: AdminEventUserListOptions = {}
): Promise<AdminEventUserOption[]> {
  const limit = Math.min(
    Math.max(1, options.limit ?? DEFAULT_ADMIN_EVENT_USER_LIMIT),
    MAX_ADMIN_EVENT_USER_LIMIT
  );
  const offset = Math.max(0, options.offset ?? 0);
  const rows = await prisma.user.findMany({
    where: adminEventUserWhereFromOptions(options),
    orderBy: [{ name: 'asc' }, { email: 'asc' }],
    skip: offset,
    take: limit,
    select: { id: true, name: true, email: true },
  });
  return rows;
}

export async function listAdminEventRows(
  filters: AdminEventListFilters
): Promise<AdminEventListRow[]> {
  const rows = await prisma.event.findMany({
    where: eventWhereFromFilters(filters),
    orderBy: [{ createdAt: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      isPublished: true,
      isSpecial: true,
      maxParticipants: true,
      requiresApproval: true,
      detailPageKind: true,
      category: { select: { id: true, name: true } },
      dates: {
        orderBy: { startDateTime: 'asc' },
        select: { id: true, startDateTime: true, endDateTime: true },
      },
    },
  });
  const countsByEventId = await registrationCountsByEventId(
    rows.map((row) => row.id)
  );
  return rows.map((row) => ({
    ...row,
    registrationCounts:
      countsByEventId.get(row.id) ?? emptyRegistrationCounts(),
  }));
}

export async function getAdminEventEditorDataBySlug(
  slug: string
): Promise<AdminEventEditorData> {
  const [event, categories, users] = await Promise.all([
    prisma.event.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        eventCategoryId: true,
        description: true,
        isSpecial: true,
        maxParticipants: true,
        requiresApproval: true,
        registrationStart: true,
        registrationEnd: true,
        createdAt: true,
        detailPageKind: true,
        externalDetailUrl: true,
        internalNotes: true,
        isPublished: true,
        createdBy: { select: { id: true, name: true, email: true } },
        dates: {
          orderBy: { startDateTime: 'asc' },
          select: { id: true, startDateTime: true, endDateTime: true },
        },
        admins: {
          orderBy: { admin: { name: 'asc' } },
          select: {
            id: true,
            adminUserId: true,
            admin: { select: { id: true, name: true, email: true } },
          },
        },
        registrationQuestions: {
          orderBy: [{ displayOrder: 'asc' }, { questionText: 'asc' }],
          select: {
            id: true,
            questionText: true,
            answerType: true,
            options: true,
            required: true,
            displayOrder: true,
          },
        },
        entryFees: {
          orderBy: [{ isDeposit: 'desc' }, { description: 'asc' }],
          select: {
            id: true,
            description: true,
            amountCents: true,
            isDeposit: true,
          },
        },
      },
    }),
    listAdminEventCategories(),
    listAdminEventUsers(),
  ]);

  if (!event) {
    return { event: null, categories, users };
  }

  const registrationCounts = await registrationCountsForEventId(event.id);

  return {
    categories,
    users,
    event: {
      ...event,
      registrationQuestions: event.registrationQuestions.map(questionFromDb),
      registrationCounts,
    },
  };
}

export async function getAdminEventDeleteBySlug(slug: string): Promise<{
  id: string;
  name: string;
  slug: string;
  registrationCount: number;
  dateCount: number;
} | null> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { registrations: true, dates: true } },
    },
  });
  if (!event) {
    return null;
  }
  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    registrationCount: event._count.registrations,
    dateCount: event._count.dates,
  };
}

export async function getAdminEventRegistrationsBySlug(
  slug: string
): Promise<AdminEventRegistrationsDto | null> {
  const event = await prisma.event.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      registrationQuestions: {
        orderBy: [{ displayOrder: 'asc' }, { questionText: 'asc' }],
        select: {
          id: true,
          questionText: true,
          answerType: true,
          options: true,
          required: true,
          displayOrder: true,
        },
      },
      registrations: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          createdAt: true,
          swimAgreementAcceptedAt: true,
          user: { select: { id: true, name: true, email: true } },
          registrationAnswers: {
            select: {
              id: true,
              value: true,
              question: {
                select: {
                  id: true,
                  questionText: true,
                  displayOrder: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!event) {
    return null;
  }

  const registrationCounts = await registrationCountsForEventId(event.id);

  const registrations = event.registrations
    .map((registration) => ({
      id: registration.id,
      status: registration.status,
      createdAt: registration.createdAt,
      swimAgreementAcceptedAt: registration.swimAgreementAcceptedAt,
      user: registration.user,
      answers: registration.registrationAnswers
        .map((answer) => ({
          id: answer.id,
          value: answer.value,
          question: answer.question,
        }))
        .toSorted((a, b) => a.question.displayOrder - b.question.displayOrder),
    }))
    .toSorted(compareRegistrations);

  return {
    id: event.id,
    name: event.name,
    slug: event.slug,
    questions: event.registrationQuestions.map(questionFromDb),
    registrations,
    registrationCounts,
  };
}
