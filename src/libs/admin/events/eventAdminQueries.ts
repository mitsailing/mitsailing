import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import {
  PaymentStatus,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import type {
  EventAddressPreset,
  PaymentStatus as PaymentStatusValue,
  EventRegistrationStatus as EventRegistrationStatusValue,
  EventSailingCardRequirement,
  LearnToSailManagedClassKind,
} from '@/generated/prisma/enums';
import { ASSIGNABLE_EVENT_ADMIN_ROLES } from '@/libs/admin/events/eventAdminSchemas';
import type { AdminEventAccessMode } from '@/libs/admin/events/zenstackEventAccess';
import { eventAccessModeWithAuthContext } from '@/libs/admin/events/zenstackEventAccess';
import { prisma } from '@/libs/DB';
import { sanitizeCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import {
  publicContentSectionsFromEvent,
  questionOptionsFromJson,
} from '@/libs/mit-sailing/eventQueries';
import type { EventPublicContentSectionDto } from '@/libs/mit-sailing/eventQueries';
import type { ZenStackDb } from '@/libs/zenstack/auth';
import type { AppAuthContext } from '@/libs/zenstack/authContext';

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

export type AdminEventRegistrationMode = 'none' | 'standard' | 'external';
export type AdminLearnToSailManagedClassKind = LearnToSailManagedClassKind;

export type AdminEventDateDto = {
  id: string;
  startDateTime: Date;
  endDateTime: Date;
};

export type AdminEventListRow = {
  accessMode: AdminEventAccessMode;
  id: string;
  name: string;
  shortName: string;
  slug: string;
  isPublished: boolean;
  isSpecial: boolean;
  maxParticipants: number | null;
  requiresApproval: boolean;
  requiresPhone: boolean;
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
  requiresPhone: boolean;
  usesTeamRegistration?: boolean;
  boatsPerTeam?: number;
  personsPerBoat?: number;
  allowRepeatTeamCaptain?: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  createdAt: Date;
  detailPageKind: 'standard' | 'external' | null;
  externalDetailUrl: string | null;
  registrationMode?: AdminEventRegistrationMode | null;
  externalRegistrationUrl?: string | null;
  externalEntriesUrl?: string | null;
  learnToSailManagedClassKind: AdminLearnToSailManagedClassKind | null;
  selectionNote: string | null;
  sailingCardRequirement: EventSailingCardRequirement;
  faqVisible?: boolean;
  faqContent?: string;
  noticeOfRaceVisible?: boolean;
  noticeOfRaceContent?: string;
  sailingInstructionsVisible?: boolean;
  sailingInstructionsContent?: string;
  resultsVisible?: boolean;
  resultsContent?: string;
  isPublished: boolean;
  paymentsEnabled: boolean;
  paymentDeadlineAt: Date | null;
  addressPreset: EventAddressPreset;
  addressName: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
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

export type AdminEventRegistrationTeamDto = {
  id: string;
  teamName: string;
};

export type AdminEventRegistrationBoatMemberDto = {
  id: string;
  boatNumber: number;
  position: number;
  positionLabel: 'helm' | 'crew';
  fullName: string;
  email: string;
};

export type AdminEventRegistrationPaymentDto = {
  id: string;
  status: PaymentStatusValue;
  amountCents: number;
  currency: string;
  receiptUrl: string | null;
  manualHandledNote: string | null;
  manualHandledByUserId: string | null;
  manualHandledBy: AdminEventUserOption | null;
  manualHandledAt: Date | null;
  resendEligible: boolean;
};

export type AdminEventRegistrationDto = {
  id: string;
  status: EventRegistrationStatusValue;
  phone: string | null;
  learnToSailWaitlistNumber: number | null;
  entryFee?: AdminEventFeeDto | null;
  createdAt: Date;
  swimAgreementAcceptedAt: Date;
  user: AdminEventUserOption;
  registrationTeam: AdminEventRegistrationTeamDto | null;
  boatMembers: AdminEventRegistrationBoatMemberDto[];
  answers: AdminEventRegistrationAnswerDto[];
  payment: AdminEventRegistrationPaymentDto | null;
};

export type AdminEventRegistrationsDto = {
  id: string;
  name: string;
  requiresPhone: boolean;
  usesTeamRegistration: boolean;
  slug: string;
  entryFees?: AdminEventFeeDto[];
  questions: AdminEventQuestionDto[];
  registrations: AdminEventRegistrationDto[];
  registrationCounts: AdminEventRegistrationCounts;
};

export type AdminEventPublicContentSectionDto =
  | {
      body: string;
      id: 'description';
      titleKey: 'content_description_title';
    }
  | EventPublicContentSectionDto;

export type AdminEventShowDto = Pick<
  AdminEventEditorDto,
  | 'admins'
  | 'dates'
  | 'description'
  | 'detailPageKind'
  | 'externalDetailUrl'
  | 'externalEntriesUrl'
  | 'externalRegistrationUrl'
  | 'id'
  | 'isPublished'
  | 'isSpecial'
  | 'learnToSailManagedClassKind'
  | 'maxParticipants'
  | 'name'
  | 'registrationEnd'
  | 'registrationMode'
  | 'registrationStart'
  | 'requiresApproval'
  | 'requiresPhone'
  | 'selectionNote'
  | 'usesTeamRegistration'
  | 'boatsPerTeam'
  | 'personsPerBoat'
  | 'allowRepeatTeamCaptain'
  | 'shortName'
  | 'slug'
> &
  Pick<
    AdminEventRegistrationsDto,
    'entryFees' | 'registrationCounts' | 'registrations'
  > & {
    accessMode: AdminEventAccessMode;
    category: AdminEventCategoryOption;
    questions: AdminEventQuestionDto[];
    publicContentSections: AdminEventPublicContentSectionDto[];
  };

export type AdminEventListFilters = {
  authContext: AppAuthContext;
  query?: string;
  categoryId?: string;
  scope?: string;
};

export type AdminEventListScope = 'my' | 'all';

type AdminEventUserListOptions = {
  limit?: number;
  offset?: number;
  query?: string;
  selectedUserIds?: readonly string[];
};
type AdminEventQueryDb = {
  event: Pick<ZenStackDb['event'], 'findFirst'>;
};
type AdminEventListRowData = Omit<
  AdminEventListRow,
  'accessMode' | 'registrationCounts'
>;
type AdminEventListRowWithAccess = AdminEventListRowData & {
  admins: readonly {
    adminUserId: string;
  }[];
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
  if (
    a.learnToSailWaitlistNumber !== null ||
    b.learnToSailWaitlistNumber !== null
  ) {
    return (
      (a.learnToSailWaitlistNumber ?? Number.POSITIVE_INFINITY) -
      (b.learnToSailWaitlistNumber ?? Number.POSITIVE_INFINITY)
    );
  }
  return b.createdAt.getTime() - a.createdAt.getTime();
}

function publicContentSectionsFromDescription(
  rawDescription: string
): AdminEventPublicContentSectionDto[] {
  const sanitizedBody = sanitizeCmsRichTextHtml(rawDescription);
  if (!sanitizedBody) {
    return [];
  }
  return [
    {
      body: sanitizedBody,
      id: 'description',
      titleKey: 'content_description_title',
    },
  ];
}

function eventPaymentResendEligible(status: PaymentStatusValue): boolean {
  return (
    status === PaymentStatus.checkout_created ||
    status === PaymentStatus.past_due ||
    status === PaymentStatus.pending
  );
}

function boatPositionLabel(
  position: number
): AdminEventRegistrationBoatMemberDto['positionLabel'] {
  return position === 0 ? 'helm' : 'crew';
}

function registrationDtosFromRows(
  rows: readonly {
    id: string;
    status: EventRegistrationStatusValue;
    phone: string | null;
    learnToSailAuditPositionAtRequest?: number | null;
    learnToSailWaitlistEntry?: {
      sequence: number;
    } | null;
    eventEntryFee: {
      id: string;
      description: string;
      amountCents: number;
      isDeposit: boolean;
    } | null;
    createdAt: Date;
    swimAgreementAcceptedAt: Date;
    user: AdminEventUserOption;
    registrationTeam?: {
      id: string;
      teamName: string;
    } | null;
    boatMembers?: readonly {
      id: string;
      boatNumber: number;
      position: number;
      fullName: string;
      email: string;
    }[];
    payment?: {
      id: string;
      status: PaymentStatusValue;
      amountCents: number;
      currency: string;
      stripeReceiptUrl: string | null;
      manualHandledNote: string | null;
      manualHandledByUserId: string | null;
      manualHandledBy: AdminEventUserOption | null;
      manualHandledAt: Date | null;
    } | null;
    registrationAnswers: readonly {
      id: string;
      value: string;
      question: {
        id: string;
        questionText: string;
        displayOrder: number;
      };
    }[];
  }[]
): AdminEventRegistrationDto[] {
  return rows
    .map((registration) => ({
      id: registration.id,
      status: registration.status,
      phone: registration.phone,
      learnToSailWaitlistNumber:
        registration.learnToSailAuditPositionAtRequest ??
        registration.learnToSailWaitlistEntry?.sequence ??
        null,
      entryFee: registration.eventEntryFee,
      createdAt: registration.createdAt,
      swimAgreementAcceptedAt: registration.swimAgreementAcceptedAt,
      user: registration.user,
      registrationTeam: registration.registrationTeam ?? null,
      boatMembers: (registration.boatMembers ?? [])
        .map((member) => ({
          id: member.id,
          boatNumber: member.boatNumber,
          position: member.position,
          positionLabel: boatPositionLabel(member.position),
          fullName: member.fullName,
          email: member.email,
        }))
        .toSorted(
          (a, b) => a.boatNumber - b.boatNumber || a.position - b.position
        ),
      payment: registration.payment
        ? {
            amountCents: registration.payment.amountCents,
            currency: registration.payment.currency,
            id: registration.payment.id,
            manualHandledAt: registration.payment.manualHandledAt,
            manualHandledBy: registration.payment.manualHandledBy,
            manualHandledByUserId: registration.payment.manualHandledByUserId,
            manualHandledNote: registration.payment.manualHandledNote,
            receiptUrl: registration.payment.stripeReceiptUrl,
            resendEligible: eventPaymentResendEligible(
              registration.payment.status
            ),
            status: registration.payment.status,
          }
        : null,
      answers: registration.registrationAnswers
        .map((answer) => ({
          id: answer.id,
          value: answer.value,
          question: answer.question,
        }))
        .toSorted((a, b) => a.question.displayOrder - b.question.displayOrder),
    }))
    .toSorted(compareRegistrations);
}

export function adminEventListScopeFromValue(
  value: string | undefined
): AdminEventListScope {
  return value === 'all' ? 'all' : 'my';
}

function eventWhereFromFilters(
  filters: AdminEventListFilters
): Prisma.EventWhereInput {
  const businessWhere: Prisma.EventWhereInput = {};
  const query = filters.query?.trim();
  const categoryId = filters.categoryId?.trim();
  if (categoryId) {
    businessWhere.eventCategoryId = categoryId;
  }
  if (query) {
    businessWhere.OR = [
      { name: { contains: query, mode: 'insensitive' } },
      { shortName: { contains: query, mode: 'insensitive' } },
      { slug: { contains: query, mode: 'insensitive' } },
    ];
  }
  if (adminEventListScopeFromValue(filters.scope) === 'my') {
    businessWhere.admins = {
      some: { adminUserId: filters.authContext.id },
    };
  }
  return businessWhere;
}

function eventListRowData(
  row: AdminEventListRowWithAccess
): AdminEventListRowData {
  return {
    category: row.category,
    dates: row.dates,
    detailPageKind: row.detailPageKind,
    id: row.id,
    isPublished: row.isPublished,
    isSpecial: row.isSpecial,
    maxParticipants: row.maxParticipants,
    name: row.name,
    requiresApproval: row.requiresApproval,
    requiresPhone: row.requiresPhone,
    shortName: row.shortName,
    slug: row.slug,
  };
}

function adminVisibleEventRows(options: {
  authContext: AppAuthContext;
  rows: readonly AdminEventListRowWithAccess[];
}): (AdminEventListRowData & { accessMode: AdminEventAccessMode })[] {
  return options.rows
    .map((row) => ({
      ...eventListRowData(row),
      accessMode: eventAccessModeWithAuthContext({
        authContext: options.authContext,
        event: row,
      }),
    }))
    .filter(
      (
        row
      ): row is AdminEventListRowData & {
        accessMode: AdminEventAccessMode;
      } => row.accessMode !== null
    );
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
  const roleWhere: Prisma.UserWhereInput = {
    appRole: { in: [...ASSIGNABLE_EVENT_ADMIN_ROLES] },
  };
  const query = options.query?.trim();
  const selectedUserIds = [
    ...new Set(
      (options.selectedUserIds ?? [])
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    ),
  ];
  if (options.query !== undefined && (!query || query.length < 2)) {
    return {
      ...roleWhere,
      id: { in: selectedUserIds },
    };
  }
  if (!query) {
    return roleWhere;
  }
  const searchableWhere: Prisma.UserWhereInput = {
    OR: [
      ...(selectedUserIds.length > 0 ? [{ id: { in: selectedUserIds } }] : []),
      { name: { contains: query, mode: 'insensitive' } },
      { email: { contains: query, mode: 'insensitive' } },
    ],
  };
  if (selectedUserIds.length > 0) {
    return {
      AND: [roleWhere, searchableWhere],
    };
  }
  return {
    ...roleWhere,
    ...searchableWhere,
  };
}

export async function listAdminEventUsers(
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
      requiresPhone: true,
      detailPageKind: true,
      admins: { select: { adminUserId: true } },
      category: { select: { id: true, name: true } },
      dates: {
        orderBy: { startDateTime: 'asc' },
        select: { id: true, startDateTime: true, endDateTime: true },
      },
    },
  });
  const authorizedRows = adminVisibleEventRows({
    authContext: filters.authContext,
    rows,
  });
  const countsByEventId = await registrationCountsByEventId(
    authorizedRows.map((row) => row.id)
  );
  return authorizedRows.map((row) => ({
    ...row,
    registrationCounts:
      countsByEventId.get(row.id) ?? emptyRegistrationCounts(),
  }));
}

export async function getAdminEventEditorDataBySlug(options: {
  db: AdminEventQueryDb;
  slug: string;
}): Promise<AdminEventEditorData> {
  const accessibleEvent = await options.db.event.findFirst({
    where: { slug: options.slug },
    select: { id: true },
  });
  const [event, categories, users] = await Promise.all([
    accessibleEvent
      ? prisma.event.findUnique({
          where: { id: accessibleEvent.id },
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
            requiresPhone: true,
            usesTeamRegistration: true,
            boatsPerTeam: true,
            personsPerBoat: true,
            allowRepeatTeamCaptain: true,
            registrationStart: true,
            registrationEnd: true,
            createdAt: true,
            detailPageKind: true,
            externalDetailUrl: true,
            registrationMode: true,
            externalRegistrationUrl: true,
            externalEntriesUrl: true,
            learnToSailManagedClassKind: true,
            selectionNote: true,
            sailingCardRequirement: true,
            faqVisible: true,
            faqContent: true,
            noticeOfRaceVisible: true,
            noticeOfRaceContent: true,
            sailingInstructionsVisible: true,
            sailingInstructionsContent: true,
            resultsVisible: true,
            resultsContent: true,
            isPublished: true,
            paymentsEnabled: true,
            paymentDeadlineAt: true,
            addressPreset: true,
            addressName: true,
            addressLine1: true,
            addressLine2: true,
            addressCity: true,
            addressState: true,
            addressPostalCode: true,
            addressCountry: true,
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
        })
      : null,
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

export async function getAdminEventDeleteBySlug(options: {
  db: AdminEventQueryDb;
  slug: string;
}): Promise<{
  id: string;
  name: string;
  slug: string;
  registrationCount: number;
  dateCount: number;
} | null> {
  const accessibleEvent = await options.db.event.findFirst({
    where: { slug: options.slug },
    select: { id: true },
  });
  if (!accessibleEvent) {
    return null;
  }
  const event = await prisma.event.findUnique({
    where: { id: accessibleEvent.id },
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

export async function getAdminEventRegistrationsBySlug(options: {
  db: AdminEventQueryDb;
  slug: string;
}): Promise<AdminEventRegistrationsDto | null> {
  const accessibleEvent = await options.db.event.findFirst({
    where: { slug: options.slug },
    select: { id: true },
  });
  if (!accessibleEvent) {
    return null;
  }
  const event = await prisma.event.findUnique({
    where: { id: accessibleEvent.id },
    select: {
      id: true,
      name: true,
      requiresPhone: true,
      usesTeamRegistration: true,
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
      entryFees: {
        orderBy: [{ isDeposit: 'desc' }, { description: 'asc' }],
        select: {
          id: true,
          description: true,
          amountCents: true,
          isDeposit: true,
        },
      },
      registrations: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          phone: true,
          learnToSailAuditPositionAtRequest: true,
          learnToSailWaitlistEntry: {
            select: {
              sequence: true,
            },
          },
          eventEntryFee: {
            select: {
              id: true,
              description: true,
              amountCents: true,
              isDeposit: true,
            },
          },
          createdAt: true,
          swimAgreementAcceptedAt: true,
          user: { select: { id: true, name: true, email: true } },
          registrationTeam: {
            select: {
              id: true,
              teamName: true,
            },
          },
          boatMembers: {
            orderBy: [{ boatNumber: 'asc' }, { position: 'asc' }],
            select: {
              id: true,
              boatNumber: true,
              position: true,
              fullName: true,
              email: true,
            },
          },
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
          payment: {
            select: {
              id: true,
              status: true,
              amountCents: true,
              currency: true,
              stripeReceiptUrl: true,
              manualHandledNote: true,
              manualHandledByUserId: true,
              manualHandledAt: true,
              manualHandledBy: {
                select: { id: true, name: true, email: true },
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
  const registrations = registrationDtosFromRows(event.registrations);

  return {
    id: event.id,
    name: event.name,
    requiresPhone: event.requiresPhone,
    usesTeamRegistration: event.usesTeamRegistration,
    slug: event.slug,
    entryFees: event.entryFees,
    questions: event.registrationQuestions.map(questionFromDb),
    registrations,
    registrationCounts,
  };
}

export async function getAdminEventShowBySlug(options: {
  accessMode: AdminEventAccessMode;
  db: AdminEventQueryDb;
  slug: string;
}): Promise<AdminEventShowDto | null> {
  const accessibleEvent = await options.db.event.findFirst({
    where: { slug: options.slug },
    select: { id: true },
  });
  if (!accessibleEvent) {
    return null;
  }
  const [event, registrationReview] = await Promise.all([
    prisma.event.findUnique({
      where: { id: accessibleEvent.id },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        description: true,
        isPublished: true,
        isSpecial: true,
        maxParticipants: true,
        requiresApproval: true,
        requiresPhone: true,
        usesTeamRegistration: true,
        boatsPerTeam: true,
        personsPerBoat: true,
        allowRepeatTeamCaptain: true,
        registrationStart: true,
        registrationEnd: true,
        detailPageKind: true,
        externalDetailUrl: true,
        registrationMode: true,
        externalRegistrationUrl: true,
        externalEntriesUrl: true,
        learnToSailManagedClassKind: true,
        selectionNote: true,
        faqVisible: true,
        faqContent: true,
        noticeOfRaceVisible: true,
        noticeOfRaceContent: true,
        sailingInstructionsVisible: true,
        sailingInstructionsContent: true,
        resultsVisible: true,
        resultsContent: true,
        category: { select: { id: true, name: true } },
        dates: {
          orderBy: { startDateTime: 'asc' },
          select: { id: true, startDateTime: true, endDateTime: true },
        },
        admins: {
          orderBy: [{ admin: { name: 'asc' } }, { admin: { email: 'asc' } }],
          select: {
            id: true,
            adminUserId: true,
            admin: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    getAdminEventRegistrationsBySlug({ db: options.db, slug: options.slug }),
  ]);
  if (!event || !registrationReview) {
    return null;
  }

  return {
    accessMode: options.accessMode,
    admins: event.admins,
    category: event.category,
    dates: event.dates,
    description: event.description,
    detailPageKind: event.detailPageKind,
    externalDetailUrl: event.externalDetailUrl,
    externalEntriesUrl: event.externalEntriesUrl,
    externalRegistrationUrl: event.externalRegistrationUrl,
    learnToSailManagedClassKind: event.learnToSailManagedClassKind,
    selectionNote: event.selectionNote,
    entryFees: registrationReview.entryFees,
    id: event.id,
    isPublished: event.isPublished,
    isSpecial: event.isSpecial,
    maxParticipants: event.maxParticipants,
    name: event.name,
    publicContentSections: [
      ...publicContentSectionsFromDescription(event.description),
      ...publicContentSectionsFromEvent(event),
    ],
    questions: registrationReview.questions,
    registrationCounts: registrationReview.registrationCounts,
    registrationEnd: event.registrationEnd,
    registrationMode: event.registrationMode,
    registrationStart: event.registrationStart,
    registrations: registrationReview.registrations,
    requiresApproval: event.requiresApproval,
    requiresPhone: event.requiresPhone,
    usesTeamRegistration: event.usesTeamRegistration,
    boatsPerTeam: event.boatsPerTeam,
    personsPerBoat: event.personsPerBoat,
    allowRepeatTeamCaptain: event.allowRepeatTeamCaptain,
    shortName: event.shortName,
    slug: event.slug,
  };
}
