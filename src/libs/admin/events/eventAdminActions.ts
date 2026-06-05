'use server';

import { randomUUID } from 'node:crypto';
import { getTranslations } from 'next-intl/server';
import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import type * as z from 'zod';
import { Prisma } from '@/generated/prisma/client';
import {
  EventPaymentNotificationKind,
  PaymentStatus,
  EventAnswerType,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import { adminFormReturnsToEdit } from '@/libs/admin/adminFormRedirect';
import type { AdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
import { requireAdminEventAccess } from '@/libs/admin/events/eventAdminAuthorization';
import {
  adminEventDeletePath,
  adminEventEditPath,
  adminEventShowPath,
  adminEventRegistrationsPath,
  adminEventsIndexPath,
  adminEventsNewPath,
} from '@/libs/admin/events/eventAdminPaths';
import {
  eventAdminBasicsFormSchema,
  eventAdminIdsFormSchema,
  eventDateFormSchema,
  eventFeeFormSchema,
  eventLocationFormSchema,
  eventPaymentManualHandledFormSchema,
  eventPaymentSettingsFormSchema,
  eventQuestionFormSchema,
  eventRegistrationStatusFormSchema,
  ASSIGNABLE_EVENT_ADMIN_ROLES,
  generateEventAdminSlug,
  isEventAdminInvalidFeeAmountIssue,
  rawEventAdminIdsFromFormData,
  rawEventBasicsFromFormData,
  rawEventDateFromFormData,
  rawEventFeeFromFormData,
  rawEventLocationFromFormData,
  rawEventPaymentManualHandledFromFormData,
  rawEventPaymentSettingsFromFormData,
  rawEventQuestionFromFormData,
  rawEventRegistrationStatusFromFormData,
} from '@/libs/admin/events/eventAdminSchemas';
import { prismaUniqueTargetIncludes } from '@/libs/admin/prismaUniqueTargetIncludes';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import {
  buildManualHandledEventPaymentTransition,
  getEventPaymentEligibility,
  nyEventPaymentNotificationDateKey,
} from '@/libs/mit-sailing/eventPayments';
import { sitemapCatalogCacheTag } from '@/libs/mit-sailing/sitemapCache';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { getI18nPath } from '@/utils/Helpers';
import { getDefaultQueue } from '@/worker/defaultQueue';
import { enqueueEventPaymentEmailJob } from '@/worker/eventPaymentEmailJob';

type EventAdminMutationCode =
  | 'validation_failed'
  | 'invalid_event_fee_amount'
  | 'capacity_full'
  | 'not_found'
  | 'duplicate_slug'
  | 'foreign_key'
  | 'unknown';

type EventAdminDbClient = typeof prisma | Prisma.TransactionClient;
type EventAdminBasicsFormData = z.infer<typeof eventAdminBasicsFormSchema>;

class EventDateValidationError extends Error {
  constructor() {
    super('Event must keep at least one date.');
  }
}

const EVENT_REGISTRATION_SETTINGS_CONFLICT_ERROR_NAME =
  'EventRegistrationSettingsConflictError';

function eventRegistrationSettingsConflictError(): Error {
  const error = new Error(
    'Event team registration settings conflict with existing registrations.'
  );
  error.name = EVENT_REGISTRATION_SETTINGS_CONFLICT_ERROR_NAME;
  return error;
}

function isEventRegistrationSettingsConflictError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === EVENT_REGISTRATION_SETTINGS_CONFLICT_ERROR_NAME
  );
}

async function lockEventForUpdate(options: {
  db: EventAdminDbClient;
  eventId: string;
}): Promise<void> {
  await options.db.$queryRaw`
    SELECT id
    FROM events
    WHERE id = ${options.eventId}
    FOR UPDATE
  `;
}

type PaymentEligibleEventFee = {
  amountCents: number;
  description: string;
  id: string;
};

type PaymentEligibleEvent = {
  entryFees: PaymentEligibleEventFee[];
  paymentDeadlineAt: Date | null;
  paymentsEnabled: boolean;
};

type RegistrationForPayment = {
  eventEntryFee: PaymentEligibleEventFee | null;
  eventId: string;
  id: string;
  status: EventRegistrationStatus;
  userId: string;
};

function logAdminEventMutationFailure(options: {
  action: string;
  error: unknown;
  slug?: string;
}): void {
  const code = safeErrorCode(options.error);
  logger.error(
    [
      `[admin-events:${options.action}]`,
      options.slug ? `slug=${options.slug}` : undefined,
      `error_name=${safeErrorName(options.error)}`,
      code ? `error_code=${code}` : undefined,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
  );
}

function mutationCodeFromPrisma(error: unknown): EventAdminMutationCode {
  if (isEventRegistrationSettingsConflictError(error)) {
    return 'validation_failed';
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return prismaUniqueTargetIncludes(error, 'slug')
        ? 'duplicate_slug'
        : 'unknown';
    }
    if (error.code === 'P2025') {
      return 'not_found';
    }
    if (error.code === 'P2003') {
      return 'foreign_key';
    }
  }
  return 'unknown';
}

function eventFeeFormMutationCode(error: z.ZodError): EventAdminMutationCode {
  for (const issue of error.issues) {
    if (isEventAdminInvalidFeeAmountIssue(issue)) {
      return 'invalid_event_fee_amount';
    }
  }
  return 'validation_failed';
}

function editUrlWithError(
  locale: string,
  slug: string,
  code: EventAdminMutationCode
): string {
  return `${getI18nPath(adminEventEditPath(slug), locale)}?error=${encodeURIComponent(
    code
  )}`;
}

function registrationsUrlWithError(
  locale: string,
  slug: string,
  code: EventAdminMutationCode
): string {
  return `${getI18nPath(adminEventRegistrationsPath(slug), locale)}?error=${encodeURIComponent(
    code
  )}`;
}

function adminEventSuccessPath(options: {
  formData: FormData;
  locale: string;
  slug: string;
}): string {
  const path = adminFormReturnsToEdit(options.formData)
    ? adminEventEditPath(options.slug)
    : adminEventShowPath(options.slug);
  return `${getI18nPath(path, options.locale)}?status=saved`;
}

function adminEventShowSuccessPath(locale: string, slug: string): string {
  return `${getI18nPath(adminEventShowPath(slug), locale)}?status=saved`;
}

function checkoutFeeForRegistration(options: {
  event: PaymentEligibleEvent;
  registration: Pick<RegistrationForPayment, 'eventEntryFee'>;
}) {
  const eligibility = getEventPaymentEligibility({
    entryFees: options.event.entryFees,
    paymentDeadlineAt: options.event.paymentDeadlineAt,
    paymentsEnabled: options.event.paymentsEnabled,
  });
  if (!eligibility.canCreatePayment || !options.registration.eventEntryFee) {
    return null;
  }
  return options.registration.eventEntryFee.amountCents > 0
    ? options.registration.eventEntryFee
    : null;
}

function canSendPaymentRequestForEvent(options: {
  event: PaymentEligibleEvent;
  now: Date;
}): boolean {
  if (
    options.event.paymentDeadlineAt &&
    options.event.paymentDeadlineAt.getTime() <= options.now.getTime()
  ) {
    return false;
  }
  return getEventPaymentEligibility({
    entryFees: options.event.entryFees,
    paymentDeadlineAt: options.event.paymentDeadlineAt,
    paymentsEnabled: options.event.paymentsEnabled,
  }).canSendRequest;
}

async function upsertRegistrationPayment(options: {
  tx: {
    payment: {
      upsert: (args: {
        create: {
          amountCents: number;
          currency: 'usd';
          eventId: string;
          id: string;
          registrationId: string;
          selectedFeeDescription: string;
          selectedFeeId: string;
          status: typeof PaymentStatus.pending;
          userId: string;
        };
        update: Record<string, never>;
        where: { registrationId: string };
      }) => Promise<{ id: string }>;
    };
  };
  event: PaymentEligibleEvent;
  registration: RegistrationForPayment;
}): Promise<{ id: string } | null> {
  const fee = checkoutFeeForRegistration(options);
  if (!fee) {
    return null;
  }
  const payment = await options.tx.payment.upsert({
    create: {
      amountCents: fee.amountCents,
      currency: 'usd',
      eventId: options.registration.eventId,
      id: randomUUID(),
      registrationId: options.registration.id,
      selectedFeeDescription: fee.description,
      selectedFeeId: fee.id,
      status: PaymentStatus.pending,
      userId: options.registration.userId,
    },
    update: {},
    where: { registrationId: options.registration.id },
  });
  return payment;
}

async function markPaymentRequestNotification(options: {
  now: Date;
  paymentId: string;
  tx: {
    eventPaymentNotification: {
      upsert: (args: {
        create: {
          id: string;
          kind: typeof EventPaymentNotificationKind.request;
          paymentId: string;
          sentDateKey: string;
        };
        update: Record<string, never>;
        where: {
          paymentId_kind_sentDateKey: {
            kind: typeof EventPaymentNotificationKind.request;
            paymentId: string;
            sentDateKey: string;
          };
        };
      }) => Promise<unknown>;
    };
  };
}): Promise<{ dateKey: string; paymentId: string }> {
  const sentDateKey = nyEventPaymentNotificationDateKey(options.now);
  await options.tx.eventPaymentNotification.upsert({
    create: {
      id: randomUUID(),
      kind: EventPaymentNotificationKind.request,
      paymentId: options.paymentId,
      sentDateKey,
    },
    update: {},
    where: {
      paymentId_kind_sentDateKey: {
        kind: EventPaymentNotificationKind.request,
        paymentId: options.paymentId,
        sentDateKey,
      },
    },
  });
  return { dateKey: sentDateKey, paymentId: options.paymentId };
}

async function enqueuePaymentRequestEmailJob(options: {
  dateKey: string;
  paymentId: string;
}): Promise<void> {
  try {
    await enqueueEventPaymentEmailJob(getDefaultQueue(), {
      dateKey: options.dateKey,
      kind: 'request',
      paymentId: options.paymentId,
    });
  } catch (error) {
    logger.error('Failed to enqueue event payment request email: {error}', {
      error,
      paymentId: options.paymentId,
    });
  }
}

function enqueuePaymentRequestEmailJobInBackground(options: {
  dateKey: string;
  paymentId: string;
}): void {
  // eslint-disable-next-line no-void
  void enqueuePaymentRequestEmailJob(options);
}

function verifiedEventIdFromAccess(options: {
  action: string;
  access: AdminEventAccess;
  eventId: string;
  locale: string;
  slug: string;
}): string {
  if (options.access.event.id !== options.eventId) {
    logAdminEventMutationFailure({
      action: options.action,
      error: new Error('Event id does not match slug'),
      slug: options.slug,
    });
    redirect(
      editUrlWithError(options.locale, options.slug, 'validation_failed')
    );
  }
  return options.access.event.id;
}

async function requireEditableAdminEvent(
  locale: string,
  slug: string
): Promise<AdminEventAccess> {
  const access = await requireAdminEventAccess({
    locale,
    minimumAccessMode: 'editable',
    slug,
  });
  if (!access) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  return access;
}

async function requireRegistrationsAdminEvent(
  locale: string,
  slug: string
): Promise<AdminEventAccess> {
  const access = await requireAdminEventAccess({
    locale,
    minimumAccessMode: 'editable',
    slug,
  });
  if (!access) {
    redirect(registrationsUrlWithError(locale, slug, 'not_found'));
  }
  return access;
}

/**
 * Zod parse params so issue messages use next-intl copy for the admin route
 * locale (explicit `{ locale }` in Server Actions).
 *
 * @param locale - Active `[locale]` segment for `getTranslations`
 * @returns Params for `schema.safeParse(data, params)` (Zod 4 `error` map)
 * @see https://next-intl.dev/docs/environments/actions-metadata-route-handlers
 */
async function adminEventZodParseParams(locale: string) {
  const t = await getTranslations({ locale, namespace: 'AdminEvents' });
  return {
    error: (iss: z.core.$ZodRawIssue) => {
      if (isEventAdminInvalidFeeAmountIssue(iss)) {
        return t('form_error_invalid_event_fee_amount');
      }
      return t('form_error_validation_failed');
    },
  };
}

function revalidateEventAdminMutation(
  locale: string,
  slugs: readonly string[]
): void {
  revalidatePath(getI18nPath('/events', locale), 'layout');
  revalidatePath(getI18nPath('/events/[slug]', locale), 'page');
  revalidatePath(getI18nPath(adminEventsIndexPath(), locale), 'layout');
  for (const slug of slugs.filter(Boolean)) {
    revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
    revalidatePath(getI18nPath(adminEventEditPath(slug), locale));
    revalidatePath(getI18nPath(adminEventShowPath(slug), locale));
    revalidatePath(getI18nPath(adminEventRegistrationsPath(slug), locale));
  }
  updateTag(sitemapCatalogCacheTag);
}

async function assertEventRegistrationSettingsRemainValid(options: {
  data: EventAdminBasicsFormData;
  db: EventAdminDbClient;
  eventId: string;
}): Promise<void> {
  if (!options.data.usesTeamRegistration) {
    const teamCount = await options.db.eventRegistrationTeam.count({
      where: { registration: { eventId: options.eventId } },
    });
    const boatMemberCount = await options.db.eventRegistrationBoatMember.count({
      where: { registration: { eventId: options.eventId } },
    });
    if (teamCount > 0 || boatMemberCount > 0) {
      throw eventRegistrationSettingsConflictError();
    }
    return;
  }

  const invalidBoatMemberCount =
    await options.db.eventRegistrationBoatMember.count({
      where: {
        registration: { eventId: options.eventId },
        OR: [
          { boatNumber: { gt: options.data.boatsPerTeam } },
          { position: { gte: options.data.personsPerBoat } },
        ],
      },
    });
  if (invalidBoatMemberCount > 0) {
    throw eventRegistrationSettingsConflictError();
  }

  if (!options.data.allowRepeatTeamCaptain) {
    const repeatCaptainTeamCount = await options.db.eventRegistrationTeam.count(
      {
        where: {
          allowRepeatCaptain: true,
          registration: { eventId: options.eventId },
        },
      }
    );
    if (repeatCaptainTeamCount > 0) {
      throw eventRegistrationSettingsConflictError();
    }
  }
}

export async function createAdminEventAction(
  locale: string,
  formData: FormData
): Promise<void> {
  const session = await requirePermission(Permission.EVENTS_MANAGE, locale);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventAdminBasicsFormSchema.safeParse(
    rawEventBasicsFromFormData(formData),
    zodParse
  );
  const parsedDate = eventDateFormSchema.safeParse(
    rawEventDateFromFormData(formData),
    zodParse
  );
  if (!parsed.success || !parsedDate.success) {
    redirect(
      `${getI18nPath(adminEventsNewPath(), locale)}?error=${encodeURIComponent(
        'validation_failed'
      )}`
    );
  }
  const { data } = parsed;
  const eventId = randomUUID();
  const slug = generateEventAdminSlug({
    dates: [parsedDate.data.startDateTime],
    name: data.name,
  });
  try {
    await prisma.event.create({
      data: {
        id: eventId,
        name: data.name,
        shortName: data.shortName,
        slug,
        eventCategoryId: data.eventCategoryId,
        description: data.description,
        isSpecial: data.isSpecial,
        requiresApproval: data.requiresApproval,
        requiresPhone: data.requiresPhone,
        sailingCardRequirement: data.sailingCardRequirement,
        usesTeamRegistration: data.usesTeamRegistration,
        boatsPerTeam: data.boatsPerTeam,
        personsPerBoat: data.personsPerBoat,
        allowRepeatTeamCaptain: data.allowRepeatTeamCaptain,
        maxParticipants: data.maxParticipants,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
        createdAt: new Date(),
        detailPageKind: data.detailPageKind,
        externalDetailUrl: data.externalDetailUrl || null,
        registrationMode: data.registrationMode,
        externalRegistrationUrl: data.externalRegistrationUrl || null,
        externalEntriesUrl: data.externalEntriesUrl || null,
        learnToSailManagedClassKind: data.learnToSailManagedClassKind,
        selectionNote: data.selectionNote,
        faqVisible: data.faqVisible,
        faqContent: data.faqContent,
        noticeOfRaceVisible: data.noticeOfRaceVisible,
        noticeOfRaceContent: data.noticeOfRaceContent,
        sailingInstructionsVisible: data.sailingInstructionsVisible,
        sailingInstructionsContent: data.sailingInstructionsContent,
        resultsVisible: data.resultsVisible,
        resultsContent: data.resultsContent,
        isPublished: data.isPublished,
        dates: {
          create: {
            id: randomUUID(),
            startDateTime: parsedDate.data.startDateTime,
            endDateTime: parsedDate.data.endDateTime,
          },
        },
        admins: {
          create: {
            id: randomUUID(),
            adminUserId: session.user.id,
          },
        },
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'create', error, slug });
    redirect(
      `${getI18nPath(adminEventsNewPath(), locale)}?error=${encodeURIComponent(
        mutationCodeFromPrisma(error)
      )}`
    );
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventShowSuccessPath(locale, slug));
}

export async function updateAdminEventBasicsAction(
  locale: string,
  currentSlug: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, currentSlug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventAdminBasicsFormSchema.safeParse(
    rawEventBasicsFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, currentSlug, 'validation_failed'));
  }
  const { data } = parsed;
  const { slug } = access.event;
  try {
    await prisma.$transaction(async (tx) => {
      await lockEventForUpdate({ db: tx, eventId: access.event.id });
      await assertEventRegistrationSettingsRemainValid({
        data,
        db: tx,
        eventId: access.event.id,
      });
      await tx.event.update({
        where: { id: access.event.id },
        data: {
          name: data.name,
          shortName: data.shortName,
          slug,
          eventCategoryId: data.eventCategoryId,
          description: data.description,
          isSpecial: data.isSpecial,
          requiresApproval: data.requiresApproval,
          requiresPhone: data.requiresPhone,
          sailingCardRequirement: data.sailingCardRequirement,
          usesTeamRegistration: data.usesTeamRegistration,
          boatsPerTeam: data.boatsPerTeam,
          personsPerBoat: data.personsPerBoat,
          allowRepeatTeamCaptain: data.allowRepeatTeamCaptain,
          maxParticipants: data.maxParticipants,
          registrationStart: data.registrationStart,
          registrationEnd: data.registrationEnd,
          detailPageKind: data.detailPageKind,
          externalDetailUrl: data.externalDetailUrl || null,
          registrationMode: data.registrationMode,
          externalRegistrationUrl: data.externalRegistrationUrl || null,
          externalEntriesUrl: data.externalEntriesUrl || null,
          learnToSailManagedClassKind: data.learnToSailManagedClassKind,
          selectionNote: data.selectionNote,
          faqVisible: data.faqVisible,
          faqContent: data.faqContent,
          noticeOfRaceVisible: data.noticeOfRaceVisible,
          noticeOfRaceContent: data.noticeOfRaceContent,
          sailingInstructionsVisible: data.sailingInstructionsVisible,
          sailingInstructionsContent: data.sailingInstructionsContent,
          resultsVisible: data.resultsVisible,
          resultsContent: data.resultsContent,
          isPublished: data.isPublished,
        },
      });
    });
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'update-basics',
      error,
      slug: currentSlug,
    });
    redirect(
      editUrlWithError(locale, currentSlug, mutationCodeFromPrisma(error))
    );
  }
  revalidateEventAdminMutation(locale, [currentSlug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function deleteAdminEventAction(
  locale: string,
  slug: string
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  try {
    await prisma.event.delete({ where: { id: access.event.id } });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'delete-event', error, slug });
    redirect(
      `${getI18nPath(adminEventDeletePath(slug), locale)}?error=${encodeURIComponent(
        mutationCodeFromPrisma(error)
      )}`
    );
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventsIndexPath(), locale));
}

export async function addAdminEventDateAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventDateFormSchema.safeParse(
    rawEventDateFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  const verifiedEventId = verifiedEventIdFromAccess({
    action: 'add-date',
    access,
    eventId,
    locale,
    slug,
  });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.eventDate.create({
        data: {
          id: randomUUID(),
          eventId: verifiedEventId,
          startDateTime: parsed.data.startDateTime,
          endDateTime: parsed.data.endDateTime,
        },
      });
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'add-date', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function updateAdminEventDateAction(
  locale: string,
  slug: string,
  dateId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventDateFormSchema.safeParse(
    rawEventDateFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventDate.updateMany({
      where: { id: dateId, eventId: access.event.id },
      data: {
        startDateTime: parsed.data.startDateTime,
        endDateTime: parsed.data.endDateTime,
      },
    });
    updatedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'update-date', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (updatedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function deleteAdminEventDateAction(
  locale: string,
  slug: string,
  dateId: string
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  let deletedCount = 0;
  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const dateCount = await tx.eventDate.count({
          where: { eventId: access.event.id },
        });
        if (dateCount <= 1) {
          throw new EventDateValidationError();
        }
        return tx.eventDate.deleteMany({
          where: { id: dateId, eventId: access.event.id },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
    deletedCount = result.count;
  } catch (error) {
    if (error instanceof EventDateValidationError) {
      redirect(editUrlWithError(locale, slug, 'validation_failed'));
    }
    logAdminEventMutationFailure({ action: 'delete-date', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (deletedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventShowSuccessPath(locale, slug));
}

export async function updateAdminEventAdminsAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventAdminIdsFormSchema.safeParse(
    rawEventAdminIdsFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  const adminUserIds = parsed.data;
  const verifiedEventId = verifiedEventIdFromAccess({
    action: 'update-admins',
    access,
    eventId,
    locale,
    slug,
  });
  const assignableUserCount = await prisma.user.count({
    where: {
      appRole: { in: [...ASSIGNABLE_EVENT_ADMIN_ROLES] },
      id: { in: adminUserIds },
    },
  });
  if (assignableUserCount !== adminUserIds.length) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.eventAdmin.deleteMany({ where: { eventId: verifiedEventId } });
      await tx.eventAdmin.createMany({
        data: adminUserIds.map((adminUserId) => ({
          id: randomUUID(),
          eventId: verifiedEventId,
          adminUserId,
        })),
      });
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'update-admins', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function addAdminEventQuestionAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventQuestionFormSchema.safeParse(
    rawEventQuestionFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  const verifiedEventId = verifiedEventIdFromAccess({
    action: 'add-question',
    access,
    eventId,
    locale,
    slug,
  });
  try {
    const maxOrder = await prisma.eventRegistrationQuestion.aggregate({
      where: { eventId: verifiedEventId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;
    const displayOrder = parsed.data.displayOrder ?? nextOrder;
    await prisma.eventRegistrationQuestion.create({
      data: {
        id: randomUUID(),
        eventId: verifiedEventId,
        questionText: parsed.data.questionText,
        answerType: parsed.data.answerType,
        options:
          parsed.data.answerType === EventAnswerType.select
            ? parsed.data.options
            : Prisma.JsonNull,
        required: parsed.data.required,
        displayOrder,
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'add-question', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function updateAdminEventQuestionAction(
  locale: string,
  slug: string,
  questionId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventQuestionFormSchema.safeParse(
    rawEventQuestionFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventRegistrationQuestion.updateMany({
      where: { id: questionId, eventId: access.event.id },
      data: {
        questionText: parsed.data.questionText,
        answerType: parsed.data.answerType,
        options:
          parsed.data.answerType === EventAnswerType.select
            ? parsed.data.options
            : Prisma.JsonNull,
        required: parsed.data.required,
        ...(parsed.data.displayOrder === null
          ? {}
          : { displayOrder: parsed.data.displayOrder }),
      },
    });
    updatedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'update-question', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (updatedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function deleteAdminEventQuestionAction(
  locale: string,
  slug: string,
  questionId: string
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  let deletedCount = 0;
  try {
    const result = await prisma.eventRegistrationQuestion.deleteMany({
      where: { id: questionId, eventId: access.event.id },
    });
    deletedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'delete-question', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (deletedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventShowSuccessPath(locale, slug));
}

export async function addAdminEventFeeAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventFeeFormSchema.safeParse(
    rawEventFeeFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(
      editUrlWithError(locale, slug, eventFeeFormMutationCode(parsed.error))
    );
  }
  const verifiedEventId = verifiedEventIdFromAccess({
    action: 'add-fee',
    access,
    eventId,
    locale,
    slug,
  });
  try {
    await prisma.eventEntryFee.create({
      data: {
        id: randomUUID(),
        eventId: verifiedEventId,
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        isDeposit: parsed.data.isDeposit,
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'add-fee', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function updateAdminEventFeeAction(
  locale: string,
  slug: string,
  feeId: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventFeeFormSchema.safeParse(
    rawEventFeeFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(
      editUrlWithError(locale, slug, eventFeeFormMutationCode(parsed.error))
    );
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventEntryFee.updateMany({
      where: { id: feeId, eventId: access.event.id },
      data: {
        description: parsed.data.description,
        amountCents: parsed.data.amountCents,
        isDeposit: parsed.data.isDeposit,
      },
    });
    updatedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'update-fee', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (updatedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventSuccessPath({ formData, locale, slug }));
}

export async function deleteAdminEventFeeAction(
  locale: string,
  slug: string,
  feeId: string
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  let deletedCount = 0;
  try {
    const result = await prisma.eventEntryFee.deleteMany({
      where: { id: feeId, eventId: access.event.id },
    });
    deletedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'delete-fee', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (deletedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(adminEventShowSuccessPath(locale, slug));
}

export async function updateAdminEventPaymentSettingsAction(
  locale: string,
  slug: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventPaymentSettingsFormSchema.safeParse(
    rawEventPaymentSettingsFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    await prisma.event.update({
      where: { id: access.event.id },
      data: parsed.data,
    });
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'update-payment-settings',
      error,
      slug,
    });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventLocationAction(
  locale: string,
  slug: string,
  formData: FormData
): Promise<void> {
  const access = await requireEditableAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventLocationFormSchema.safeParse(
    rawEventLocationFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    await prisma.event.update({
      where: { id: access.event.id },
      data: parsed.data,
    });
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'update-location',
      error,
      slug,
    });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventRegistrationStatusAction(
  locale: string,
  slug: string,
  registrationId: string,
  formData: FormData
): Promise<void> {
  const access = await requireRegistrationsAdminEvent(locale, slug);
  let paymentRequestJob: { dateKey: string; paymentId: string } | null = null;
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventRegistrationStatusFormSchema.safeParse(
    rawEventRegistrationStatusFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(registrationsUrlWithError(locale, slug, 'validation_failed'));
  }
  let result: {
    errorCode: EventAdminMutationCode | null;
    updatedCount: number;
  };
  try {
    result = await prisma.$transaction(
      async (tx) => {
        const registration = await tx.eventRegistration.findFirst({
          where: { id: registrationId, eventId: access.event.id },
          select: {
            eventEntryFee: {
              select: { amountCents: true, description: true, id: true },
            },
            eventId: true,
            id: true,
            status: true,
            userId: true,
          },
        });
        if (!registration) {
          return { errorCode: null, updatedCount: 0 };
        }

        await tx.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM events
          WHERE id = ${registration.eventId}
          FOR UPDATE
        `;
        const event = await tx.event.findUnique({
          where: { id: registration.eventId },
          select: {
            maxParticipants: true,
            paymentDeadlineAt: true,
            paymentsEnabled: true,
            entryFees: {
              orderBy: [{ isDeposit: 'desc' }, { description: 'asc' }],
              select: { amountCents: true, description: true, id: true },
            },
          },
        });
        if (!event) {
          return { errorCode: null, updatedCount: 0 };
        }

        if (
          parsed.data.status === EventRegistrationStatus.approved &&
          registration.status !== EventRegistrationStatus.approved &&
          event.maxParticipants !== null
        ) {
          const approvedCount = await tx.eventRegistration.count({
            where: {
              eventId: registration.eventId,
              id: { not: registrationId },
              status: EventRegistrationStatus.approved,
            },
          });
          if (approvedCount >= event.maxParticipants) {
            return { errorCode: 'capacity_full', updatedCount: 0 };
          }
        }

        const updateResult = await tx.eventRegistration.updateMany({
          where: { id: registrationId, eventId: access.event.id },
          data: { status: parsed.data.status },
        });
        if (
          updateResult.count > 0 &&
          parsed.data.status === EventRegistrationStatus.approved &&
          registration.status !== EventRegistrationStatus.approved
        ) {
          const payment = await upsertRegistrationPayment({
            event,
            registration,
            tx,
          });
          const now = new Date();
          if (payment && canSendPaymentRequestForEvent({ event, now })) {
            paymentRequestJob = await markPaymentRequestNotification({
              now,
              paymentId: payment.id,
              tx,
            });
          }
        }
        return { errorCode: null, updatedCount: updateResult.count };
      },
      {
        maxWait: 5000,
        timeout: 10_000,
      }
    );
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'update-registration-status',
      error,
      slug,
    });
    redirect(
      registrationsUrlWithError(locale, slug, mutationCodeFromPrisma(error))
    );
  }
  if (result.errorCode) {
    redirect(registrationsUrlWithError(locale, slug, result.errorCode));
  }
  if (result.updatedCount === 0) {
    redirect(registrationsUrlWithError(locale, slug, 'not_found'));
  }
  if (paymentRequestJob) {
    enqueuePaymentRequestEmailJobInBackground(paymentRequestJob);
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventRegistrationsPath(slug), locale));
}

export async function resendAdminEventPaymentRequestAction(
  locale: string,
  slug: string,
  paymentId: string
): Promise<void> {
  const access = await requireRegistrationsAdminEvent(locale, slug);
  let foundPayment = false;
  try {
    const now = new Date();
    const payment = await prisma.payment.findFirst({
      where: {
        eventId: access.event.id,
        id: paymentId,
        event: { paymentDeadlineAt: { gt: now }, paymentsEnabled: true },
        status: {
          in: [
            PaymentStatus.checkout_created,
            PaymentStatus.past_due,
            PaymentStatus.pending,
          ],
        },
      },
      select: { id: true },
    });
    foundPayment = payment !== null;
    if (payment) {
      const paymentRequestJob = await markPaymentRequestNotification({
        now,
        paymentId: payment.id,
        tx: prisma,
      });
      enqueuePaymentRequestEmailJobInBackground(paymentRequestJob);
    }
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'resend-payment-request',
      error,
      slug,
    });
    redirect(
      registrationsUrlWithError(locale, slug, mutationCodeFromPrisma(error))
    );
  }
  if (!foundPayment) {
    redirect(registrationsUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventRegistrationsPath(slug), locale));
}

export async function resendAllAdminEventPaymentRequestsAction(
  locale: string,
  slug: string
): Promise<void> {
  const access = await requireRegistrationsAdminEvent(locale, slug);
  const paymentRequestJobs: { dateKey: string; paymentId: string }[] = [];
  try {
    const now = new Date();
    const payments = await prisma.payment.findMany({
      where: {
        eventId: access.event.id,
        event: { paymentDeadlineAt: { gt: now }, paymentsEnabled: true },
        status: {
          in: [
            PaymentStatus.checkout_created,
            PaymentStatus.past_due,
            PaymentStatus.pending,
          ],
        },
      },
      select: { id: true },
    });
    for (const payment of payments) {
      paymentRequestJobs.push(
        await markPaymentRequestNotification({
          now,
          paymentId: payment.id,
          tx: prisma,
        })
      );
    }
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'resend-all-payment-requests',
      error,
      slug,
    });
    redirect(
      registrationsUrlWithError(locale, slug, mutationCodeFromPrisma(error))
    );
  }
  for (const paymentRequestJob of paymentRequestJobs) {
    enqueuePaymentRequestEmailJobInBackground(paymentRequestJob);
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventRegistrationsPath(slug), locale));
}

export async function markAdminEventPaymentHandledAction(
  locale: string,
  slug: string,
  paymentId: string,
  formData: FormData
): Promise<void> {
  const access = await requireRegistrationsAdminEvent(locale, slug);
  const zodParse = await adminEventZodParseParams(locale);
  const parsed = eventPaymentManualHandledFormSchema.safeParse(
    rawEventPaymentManualHandledFromFormData(formData),
    zodParse
  );
  if (!parsed.success) {
    redirect(registrationsUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const transition = buildManualHandledEventPaymentTransition({
      adminUserId: access.session.user.id,
      note: parsed.data.note,
      now: new Date(),
      status: PaymentStatus.pending,
    });
    const result = await prisma.payment.updateMany({
      where: {
        eventId: access.event.id,
        id: paymentId,
        status: {
          in: [
            PaymentStatus.checkout_created,
            PaymentStatus.past_due,
            PaymentStatus.pending,
          ],
        },
      },
      data: transition,
    });
    updatedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'mark-payment-handled',
      error,
      slug,
    });
    redirect(
      registrationsUrlWithError(locale, slug, mutationCodeFromPrisma(error))
    );
  }
  if (updatedCount === 0) {
    redirect(registrationsUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventRegistrationsPath(slug), locale));
}
