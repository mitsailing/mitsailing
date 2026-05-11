'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Prisma } from '@/generated/prisma/client';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { EventAnswerType } from '@/generated/prisma/enums';
import { requireCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { questionOptionsFromJson } from '@/libs/mit-sailing/eventQueries';
import { parsePublicEventRegistrationAnswersFromForm } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { PublicRegistrationQuestionForValidation } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { getI18nPath } from '@/utils/Helpers';

class EventRegistrationFlowError extends Error {
  readonly code: EventRegistrationMutationCode;

  constructor(code: EventRegistrationMutationCode) {
    super(`Event registration: ${code}`);
    this.name = 'EventRegistrationFlowError';
    this.code = code;
  }
}

export type PublicEventRegistrationFormState = {
  code: EventRegistrationMutationCode | null;
  fieldErrors: Record<string, EventRegistrationMutationCode>;
  status: 'idle' | 'error';
  values: Record<string, string[]>;
};

function publicEventRegistrationFormValues(
  formData: FormData
): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const [name, value] of formData) {
    if (typeof value !== 'string') {
      continue;
    }
    values[name] = [...(values[name] ?? []), value];
  }
  return values;
}

function publicEventRegistrationFormErrorState(options: {
  code: EventRegistrationMutationCode;
  fieldErrors: Record<string, EventRegistrationMutationCode>;
  formData: FormData;
}): PublicEventRegistrationFormState {
  return {
    code: options.code,
    fieldErrors: options.fieldErrors,
    status: 'error',
    values: publicEventRegistrationFormValues(options.formData),
  };
}

function publicEventRegistrationQuestionFieldErrors(options: {
  code: 'answers_invalid' | 'questions_required';
  formData: FormData;
  questions: PublicRegistrationQuestionForValidation[];
}): Record<string, EventRegistrationMutationCode> {
  const fieldErrors: Record<string, EventRegistrationMutationCode> = {};

  for (const question of options.questions) {
    const result = parsePublicEventRegistrationAnswersFromForm(
      [question],
      options.formData
    );
    if (!result.ok && result.code === options.code) {
      fieldErrors[`question_${question.id}`] = options.code;
    }
  }

  return fieldErrors;
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
  _prevState: PublicEventRegistrationFormState,
  formData: FormData
): Promise<PublicEventRegistrationFormState> {
  const callbackUrl = `/events/${encodeURIComponent(slug)}/register`;
  const user = await requireCurrentUser(locale, callbackUrl);
  const swimAgreement = formData.get('swimAgreementAccepted');
  if (swimAgreement !== 'true') {
    return publicEventRegistrationFormErrorState({
      code: 'swim_agreement_required',
      fieldErrors: { swimAgreementAccepted: 'swim_agreement_required' },
      formData,
    });
  }

  const now = new Date();
  let event: {
    id: string;
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
        registrationStart: true,
        registrationEnd: true,
        registrationQuestions: {
          orderBy: [{ displayOrder: 'asc' }, { questionText: 'asc' }],
          select: { id: true, required: true, answerType: true, options: true },
        },
      },
    });
  } catch (error) {
    unstable_rethrow(error);
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
    return publicEventRegistrationFormErrorState({
      code: parsedAnswers.code,
      fieldErrors: publicEventRegistrationQuestionFieldErrors({
        code: parsedAnswers.code,
        formData,
        questions: questionsForValidation,
      }),
      formData,
    });
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM events
          WHERE id = ${event.id}
          FOR UPDATE
        `;
        const lockedEvent = await tx.event.findUnique({
          where: { id: event.id },
          select: {
            id: true,
            isPublished: true,
            maxParticipants: true,
            requiresApproval: true,
            registrationStart: true,
            registrationEnd: true,
          },
        });
        if (!lockedEvent || !lockedEvent.isPublished) {
          throw new EventRegistrationFlowError('not_found');
        }
        if (
          !isRegistrationOpen({
            now,
            registrationStart: lockedEvent.registrationStart,
            registrationEnd: lockedEvent.registrationEnd,
          })
        ) {
          throw new EventRegistrationFlowError('closed');
        }
        const status = lockedEvent.requiresApproval
          ? EventRegistrationStatus.pending
          : EventRegistrationStatus.approved;

        const existing = await tx.eventRegistration.findFirst({
          where: { eventId: event.id, userId: user.id },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        // Pending applications do not consume accepted capacity; only gate new
        // auto-approved registrations when every seat already has an approval.
        if (!lockedEvent.requiresApproval) {
          const approvedSlotsExcludingSelf = await tx.eventRegistration.count({
            where: {
              eventId: event.id,
              ...(existing ? { id: { not: existing.id } } : {}),
              status: EventRegistrationStatus.approved,
            },
          });
          if (
            lockedEvent.maxParticipants !== null &&
            approvedSlotsExcludingSelf >= lockedEvent.maxParticipants
          ) {
            throw new EventRegistrationFlowError('full');
          }
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
    unstable_rethrow(error);
    if (error instanceof EventRegistrationFlowError) {
      redirect(eventRegistrationErrorUrl(locale, slug, error.code));
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
    unstable_rethrow(error);
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
    unstable_rethrow(error);
    logPublicEventRegistrationFailure({ action: 'cancel', error, slug });
    redirect(eventDetailErrorUrl(locale, slug, mutationCodeFromPrisma(error)));
  }

  revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
  redirect(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
}
