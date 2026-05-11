'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { EventAnswerType } from '@/generated/prisma/enums';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { questionOptionsFromJson } from '@/libs/mit-sailing/eventQueries';
import { parsePublicEventRegistrationAnswersFromForm } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { getI18nPath } from '@/utils/Helpers';

class EventRegistrationFullError extends Error {
  constructor() {
    super('Event registration is full');
    this.name = 'EventRegistrationFullError';
  }
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
    registrationQuestions: {
      id: string;
      required: boolean;
      answerType: EventAnswerType;
      options: Prisma.JsonValue | null;
    }[];
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
          select: { id: true, required: true, answerType: true, options: true },
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

  const questionsForValidation = event.registrationQuestions.map(
    (question) => ({
      id: question.id,
      required: question.required,
      answerType: question.answerType,
      options: questionOptionsFromJson(question.options),
    })
  );
  const parsedAnswers = parsePublicEventRegistrationAnswersFromForm(
    questionsForValidation,
    formData
  );
  if (!parsedAnswers.ok) {
    redirect(eventRegistrationErrorUrl(locale, slug, parsedAnswers.code));
  }

  try {
    const status = event.requiresApproval
      ? EventRegistrationStatus.pending
      : EventRegistrationStatus.approved;
    await prisma.$transaction(
      async (tx) => {
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
            ...(existing ? { id: { not: existing.id } } : {}),
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

        const answers = parsedAnswers.answers.map((answer) => ({
          id: randomUUID(),
          registrationId,
          questionId: answer.questionId,
          value: answer.value,
        }));

        if (answers.length > 0) {
          await tx.eventRegistrationAnswer.createMany({ data: answers });
        }
      },
      {
        maxWait: 5000,
        timeout: 10_000,
      }
    );
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
