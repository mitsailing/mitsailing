'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getI18nPath } from '@/utils/Helpers';

type EventRegistrationMutationCode =
  | 'closed'
  | 'full'
  | 'not_found'
  | 'questions_required'
  | 'swim_agreement_required'
  | 'unknown';

class EventRegistrationFullError extends Error {
  constructor() {
    super('Event registration is full');
    this.name = 'EventRegistrationFullError';
  }
}

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

function logPublicEventRegistrationFailure(options: {
  action: string;
  error: unknown;
  slug: string;
}): void {
  const code = safeErrorCode(options.error);
  logger.error(
    [
      `[public-event-registration:${options.action}]`,
      `slug=${options.slug}`,
      `error_name=${safeErrorName(options.error)}`,
      code ? `error_code=${code}` : undefined,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
  );
}

function eventDetailErrorUrl(
  locale: string,
  slug: string,
  code: EventRegistrationMutationCode
): string {
  return `${getI18nPath(`/events/${encodeURIComponent(slug)}`, locale)}?registration=${encodeURIComponent(
    code
  )}`;
}

function eventRegistrationErrorUrl(
  locale: string,
  slug: string,
  code: EventRegistrationMutationCode
): string {
  return `${getI18nPath(`/events/${encodeURIComponent(slug)}/register`, locale)}?registration=${encodeURIComponent(
    code
  )}`;
}

function isNonEmptyFormValue(
  value: FormDataEntryValue | null
): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function answerForQuestion(questionId: string, formData: FormData): string {
  const value = formData.get(`question_${questionId}`);
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
}

function isRegistrationOpen(options: {
  now: Date;
  registrationStart: Date | null;
  registrationEnd: Date | null;
}): boolean {
  if (options.registrationStart && options.now < options.registrationStart) {
    return false;
  }
  if (options.registrationEnd && options.now > options.registrationEnd) {
    return false;
  }
  return true;
}

function mutationCodeFromPrisma(error: unknown): EventRegistrationMutationCode {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return 'not_found';
  }
  return 'unknown';
}

export async function createPublicEventRegistrationAction(
  locale: string,
  slug: string,
  formData: FormData
): Promise<void> {
  const callbackUrl = `/events/${encodeURIComponent(slug)}/register`;
  const user = await requireCurrentUser(locale, callbackUrl);
  const swimAgreement = formData.get('swimAgreementAccepted');
  if (swimAgreement !== 'true') {
    redirect(
      eventRegistrationErrorUrl(locale, slug, 'swim_agreement_required')
    );
  }

  const now = new Date();
  let event: {
    id: string;
    maxParticipants: number | null;
    requiresApproval: boolean;
    registrationStart: Date | null;
    registrationEnd: Date | null;
    registrationQuestions: { id: string; required: boolean }[];
  } | null;
  try {
    event = await prisma.event.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        maxParticipants: true,
        requiresApproval: true,
        registrationStart: true,
        registrationEnd: true,
        registrationQuestions: {
          orderBy: [{ displayOrder: 'asc' }, { questionText: 'asc' }],
          select: { id: true, required: true },
        },
      },
    });
  } catch (error) {
    logPublicEventRegistrationFailure({ action: 'load-event', error, slug });
    redirect(
      eventRegistrationErrorUrl(locale, slug, mutationCodeFromPrisma(error))
    );
  }
  if (!event) {
    redirect(eventRegistrationErrorUrl(locale, slug, 'not_found'));
  }
  if (
    !isRegistrationOpen({
      now,
      registrationStart: event.registrationStart,
      registrationEnd: event.registrationEnd,
    })
  ) {
    redirect(eventRegistrationErrorUrl(locale, slug, 'closed'));
  }

  const missingRequiredAnswer = event.registrationQuestions.some(
    (question) =>
      question.required &&
      !isNonEmptyFormValue(formData.get(`question_${question.id}`))
  );
  if (missingRequiredAnswer) {
    redirect(eventRegistrationErrorUrl(locale, slug, 'questions_required'));
  }

  try {
    const status = event.requiresApproval
      ? EventRegistrationStatus.pending
      : EventRegistrationStatus.approved;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM events
        WHERE id = ${event.id}
        FOR UPDATE
      `;
      const existing = await tx.eventRegistration.findFirst({
        where: { eventId: event.id, userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      const reservedSlots = await tx.eventRegistration.count({
        where: {
          eventId: event.id,
          id: existing ? { not: existing.id } : undefined,
          status: {
            in: [
              EventRegistrationStatus.approved,
              EventRegistrationStatus.pending,
            ],
          },
        },
      });
      if (
        event.maxParticipants !== null &&
        reservedSlots >= event.maxParticipants
      ) {
        throw new EventRegistrationFullError();
      }

      const registrationId = existing?.id ?? randomUUID();
      if (existing) {
        await tx.eventRegistration.update({
          where: { id: existing.id },
          data: {
            status,
            swimAgreementAcceptedAt: now,
            registrationAnswers: { deleteMany: {} },
          },
        });
      }
      if (!existing) {
        await tx.eventRegistration.create({
          data: {
            id: registrationId,
            eventId: event.id,
            userId: user.id,
            status,
            createdAt: now,
            swimAgreementAcceptedAt: now,
          },
        });
      }

      const answers = event.registrationQuestions
        .map((question) => ({
          id: randomUUID(),
          registrationId,
          questionId: question.id,
          value: answerForQuestion(question.id, formData),
        }))
        .filter((answer) => answer.value.length > 0);

      if (answers.length > 0) {
        await tx.eventRegistrationAnswer.createMany({ data: answers });
      }
    });
  } catch (error) {
    if (error instanceof EventRegistrationFullError) {
      redirect(eventRegistrationErrorUrl(locale, slug, 'full'));
    }
    logPublicEventRegistrationFailure({ action: 'create', error, slug });
    redirect(
      eventRegistrationErrorUrl(locale, slug, mutationCodeFromPrisma(error))
    );
  }

  revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
  redirect(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
}

export async function cancelPublicEventRegistrationAction(
  locale: string,
  slug: string
): Promise<void> {
  const callbackUrl = `/events/${encodeURIComponent(slug)}`;
  const user = await requireCurrentUser(locale, callbackUrl);
  let event: { id: string } | null;
  try {
    event = await prisma.event.findFirst({
      where: { slug, isPublished: true },
      select: { id: true },
    });
  } catch (error) {
    logPublicEventRegistrationFailure({
      action: 'load-cancel-event',
      error,
      slug,
    });
    redirect(eventDetailErrorUrl(locale, slug, mutationCodeFromPrisma(error)));
  }
  if (!event) {
    redirect(eventDetailErrorUrl(locale, slug, 'not_found'));
  }
  try {
    await prisma.eventRegistration.updateMany({
      where: { eventId: event.id, userId: user.id },
      data: { status: EventRegistrationStatus.cancelled },
    });
  } catch (error) {
    logPublicEventRegistrationFailure({ action: 'cancel', error, slug });
    redirect(eventDetailErrorUrl(locale, slug, mutationCodeFromPrisma(error)));
  }

  revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
  redirect(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
}
