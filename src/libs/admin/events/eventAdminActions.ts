'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { EventAnswerType } from '@/generated/prisma/enums';
import {
  adminEventDeletePath,
  adminEventEditPath,
  adminEventRegistrationsPath,
  adminEventsIndexPath,
  adminEventsNewPath,
} from '@/libs/admin/events/eventAdminPaths';
import {
  eventAdminBasicsFormSchema,
  eventDateFormSchema,
  eventFeeFormSchema,
  eventQuestionFormSchema,
  eventRegistrationStatusFormSchema,
  rawEventAdminIdsFromFormData,
  rawEventBasicsFromFormData,
  rawEventDateFromFormData,
  rawEventFeeFromFormData,
  rawEventQuestionFromFormData,
  rawEventRegistrationStatusFromFormData,
} from '@/libs/admin/events/eventAdminSchemas';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getI18nPath } from '@/utils/Helpers';

type EventAdminMutationCode =
  | 'validation_failed'
  | 'not_found'
  | 'duplicate_slug'
  | 'foreign_key'
  | 'unknown';

function safeErrorName(error: unknown): string {
  if (error instanceof Error) {
    return error.name;
  }
  return typeof error;
}

function safeErrorCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return undefined;
}

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
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return 'duplicate_slug';
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

function editUrlWithError(
  locale: string,
  slug: string,
  code: EventAdminMutationCode
): string {
  return `${getI18nPath(adminEventEditPath(slug), locale)}?error=${encodeURIComponent(
    code
  )}`;
}

function revalidateEventAdminMutation(
  locale: string,
  slugs: readonly string[]
): void {
  revalidatePath(getI18nPath('/events', locale), 'layout');
  revalidatePath(getI18nPath(adminEventsIndexPath(), locale), 'layout');
  for (const slug of slugs.filter(Boolean)) {
    revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
    revalidatePath(getI18nPath(adminEventEditPath(slug), locale));
    revalidatePath(getI18nPath(adminEventRegistrationsPath(slug), locale));
  }
  revalidateTag('sitemap-catalog', 'max');
}

export async function createAdminEventAction(
  locale: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const parsed = eventAdminBasicsFormSchema.safeParse(
    rawEventBasicsFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(
      `${getI18nPath(adminEventsNewPath(), locale)}?error=${encodeURIComponent(
        'validation_failed'
      )}`
    );
  }
  const { data } = parsed;
  try {
    await prisma.event.create({
      data: {
        id: randomUUID(),
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        eventCategoryId: data.eventCategoryId,
        description: data.description,
        isSpecial: data.isSpecial,
        requiresApproval: data.requiresApproval,
        maxParticipants: data.maxParticipants,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
        createdByUserId: session.user.id,
        createdAt: new Date(),
        detailPageKind: data.detailPageKind,
        externalDetailUrl: data.externalDetailUrl || null,
        internalNotes: data.internalNotes || null,
        isPublished: data.isPublished,
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'create', error, slug: data.slug });
    redirect(
      `${getI18nPath(adminEventsNewPath(), locale)}?error=${encodeURIComponent(
        mutationCodeFromPrisma(error)
      )}`
    );
  }
  revalidateEventAdminMutation(locale, [data.slug]);
  redirect(getI18nPath(adminEventEditPath(data.slug), locale));
}

export async function updateAdminEventBasicsAction(
  locale: string,
  currentSlug: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventAdminBasicsFormSchema.safeParse(
    rawEventBasicsFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, currentSlug, 'validation_failed'));
  }
  const { data } = parsed;
  try {
    await prisma.event.update({
      where: { slug: currentSlug },
      data: {
        name: data.name,
        shortName: data.shortName,
        slug: data.slug,
        eventCategoryId: data.eventCategoryId,
        description: data.description,
        isSpecial: data.isSpecial,
        requiresApproval: data.requiresApproval,
        maxParticipants: data.maxParticipants,
        registrationStart: data.registrationStart,
        registrationEnd: data.registrationEnd,
        detailPageKind: data.detailPageKind,
        externalDetailUrl: data.externalDetailUrl || null,
        internalNotes: data.internalNotes || null,
        isPublished: data.isPublished,
      },
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
  revalidateEventAdminMutation(locale, [currentSlug, data.slug]);
  redirect(getI18nPath(adminEventEditPath(data.slug), locale));
}

export async function deleteAdminEventAction(
  locale: string,
  slug: string
): Promise<void> {
  await requireAdmin(locale);
  try {
    await prisma.event.delete({ where: { slug } });
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
  await requireAdmin(locale);
  const parsed = eventDateFormSchema.safeParse(
    rawEventDateFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    await prisma.eventDate.create({
      data: {
        id: randomUUID(),
        eventId,
        startDateTime: parsed.data.startDateTime,
        endDateTime: parsed.data.endDateTime,
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'add-date', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventDateAction(
  locale: string,
  slug: string,
  dateId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventDateFormSchema.safeParse(
    rawEventDateFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventDate.updateMany({
      where: { id: dateId, event: { slug } },
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function deleteAdminEventDateAction(
  locale: string,
  slug: string,
  dateId: string
): Promise<void> {
  await requireAdmin(locale);
  let deletedCount = 0;
  try {
    const result = await prisma.eventDate.deleteMany({
      where: { id: dateId, event: { slug } },
    });
    deletedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({ action: 'delete-date', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (deletedCount === 0) {
    redirect(editUrlWithError(locale, slug, 'not_found'));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventAdminsAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const adminUserIds = [...new Set(rawEventAdminIdsFromFormData(formData))];
  try {
    await prisma.$transaction(async (tx) => {
      await tx.eventAdmin.deleteMany({ where: { eventId } });
      if (adminUserIds.length > 0) {
        await tx.eventAdmin.createMany({
          data: adminUserIds.map((adminUserId) => ({
            id: randomUUID(),
            eventId,
            adminUserId,
          })),
        });
      }
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'update-admins', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function addAdminEventQuestionAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventQuestionFormSchema.safeParse(
    rawEventQuestionFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    const maxOrder = await prisma.eventRegistrationQuestion.aggregate({
      where: { eventId },
      _max: { displayOrder: true },
    });
    const nextOrder = (maxOrder._max.displayOrder ?? 0) + 1;
    await prisma.eventRegistrationQuestion.create({
      data: {
        id: randomUUID(),
        eventId,
        questionText: parsed.data.questionText,
        answerType: parsed.data.answerType,
        options:
          parsed.data.answerType === EventAnswerType.select
            ? parsed.data.options
            : Prisma.JsonNull,
        required: parsed.data.required,
        displayOrder: nextOrder,
      },
    });
  } catch (error) {
    logAdminEventMutationFailure({ action: 'add-question', error, slug });
    redirect(editUrlWithError(locale, slug, mutationCodeFromPrisma(error)));
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventQuestionAction(
  locale: string,
  slug: string,
  questionId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventQuestionFormSchema.safeParse(
    rawEventQuestionFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventRegistrationQuestion.updateMany({
      where: { id: questionId, event: { slug } },
      data: {
        questionText: parsed.data.questionText,
        answerType: parsed.data.answerType,
        options:
          parsed.data.answerType === EventAnswerType.select
            ? parsed.data.options
            : Prisma.JsonNull,
        required: parsed.data.required,
        displayOrder: parsed.data.displayOrder,
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function deleteAdminEventQuestionAction(
  locale: string,
  slug: string,
  questionId: string
): Promise<void> {
  await requireAdmin(locale);
  let deletedCount = 0;
  try {
    const result = await prisma.eventRegistrationQuestion.deleteMany({
      where: { id: questionId, event: { slug } },
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function addAdminEventFeeAction(
  locale: string,
  slug: string,
  eventId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventFeeFormSchema.safeParse(
    rawEventFeeFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  try {
    await prisma.eventEntryFee.create({
      data: {
        id: randomUUID(),
        eventId,
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventFeeAction(
  locale: string,
  slug: string,
  feeId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventFeeFormSchema.safeParse(
    rawEventFeeFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(editUrlWithError(locale, slug, 'validation_failed'));
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventEntryFee.updateMany({
      where: { id: feeId, event: { slug } },
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function deleteAdminEventFeeAction(
  locale: string,
  slug: string,
  feeId: string
): Promise<void> {
  await requireAdmin(locale);
  let deletedCount = 0;
  try {
    const result = await prisma.eventEntryFee.deleteMany({
      where: { id: feeId, event: { slug } },
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
  redirect(getI18nPath(adminEventEditPath(slug), locale));
}

export async function updateAdminEventRegistrationStatusAction(
  locale: string,
  slug: string,
  registrationId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = eventRegistrationStatusFormSchema.safeParse(
    rawEventRegistrationStatusFromFormData(formData)
  );
  if (!parsed.success) {
    redirect(
      `${getI18nPath(adminEventRegistrationsPath(slug), locale)}?error=${encodeURIComponent(
        'validation_failed'
      )}`
    );
  }
  let updatedCount = 0;
  try {
    const result = await prisma.eventRegistration.updateMany({
      where: { id: registrationId, event: { slug } },
      data: { status: parsed.data.status },
    });
    updatedCount = result.count;
  } catch (error) {
    logAdminEventMutationFailure({
      action: 'update-registration-status',
      error,
      slug,
    });
    redirect(
      `${getI18nPath(adminEventRegistrationsPath(slug), locale)}?error=${encodeURIComponent(
        mutationCodeFromPrisma(error)
      )}`
    );
  }
  if (updatedCount === 0) {
    redirect(
      `${getI18nPath(adminEventRegistrationsPath(slug), locale)}?error=${encodeURIComponent(
        'not_found'
      )}`
    );
  }
  revalidateEventAdminMutation(locale, [slug]);
  redirect(getI18nPath(adminEventRegistrationsPath(slug), locale));
}
