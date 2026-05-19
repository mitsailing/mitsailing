'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import * as z from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { EventRegistrationStatus } from '@/generated/prisma/enums';
import type { EventAnswerType } from '@/generated/prisma/enums';
import { verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { questionOptionsFromJson } from '@/libs/mit-sailing/eventQueries';
import { parsePublicEventRegistrationAnswersFromForm } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { PublicRegistrationQuestionForValidation } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { isPublicEventRegistrationWindowOpen } from '@/libs/mit-sailing/eventRegistrationWindow';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';
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

const swimAgreementFieldName = 'swimAgreementAccepted';
const phoneFieldName = 'phone';
const eventEntryFeeFieldName = 'eventEntryFeeId';
const teamNameFieldName = 'teamName';
const emailField = z.email();

function publicEventRegistrationQuestionFieldName(questionId: string): string {
  return `question_${questionId}`;
}

function teamBoatMemberFieldName(options: {
  boatNumber: number;
  boatsPerTeam: number;
  position: number;
  suffix: 'email' | 'name';
}): string {
  if (options.boatsPerTeam === 1) {
    return `teamBoatMember_${options.position}_${options.suffix}`;
  }
  return `teamBoatMember_${options.boatNumber}_${options.position}_${options.suffix}`;
}

function teamBoatMemberNameFieldName(options: {
  boatNumber: number;
  boatsPerTeam: number;
  position: number;
}): string {
  return teamBoatMemberFieldName({ ...options, suffix: 'name' });
}

function teamBoatMemberEmailFieldName(options: {
  boatNumber: number;
  boatsPerTeam: number;
  position: number;
}): string {
  return teamBoatMemberFieldName({ ...options, suffix: 'email' });
}

function publicEventRegistrationFormValues(
  formData: FormData,
  fieldNames: readonly string[]
): Record<string, string[]> {
  const values: Record<string, string[]> = {};
  for (const fieldName of fieldNames) {
    const fieldValues = formData
      .getAll(fieldName)
      .filter((value): value is string => typeof value === 'string');
    if (fieldValues.length > 0) {
      values[fieldName] = fieldValues;
    }
  }
  return values;
}

function publicEventRegistrationFormErrorState(options: {
  code: EventRegistrationMutationCode;
  fieldErrors: Record<string, EventRegistrationMutationCode>;
  fieldNames: readonly string[];
  formData: FormData;
}): PublicEventRegistrationFormState {
  return {
    code: options.code,
    fieldErrors: options.fieldErrors,
    status: 'error',
    values: publicEventRegistrationFormValues(
      options.formData,
      options.fieldNames
    ),
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
      fieldErrors[publicEventRegistrationQuestionFieldName(question.id)] =
        options.code;
    }
  }

  return fieldErrors;
}

function publicEventRegistrationFieldNames(
  questions: PublicRegistrationQuestionForValidation[],
  boatsPerTeam: number,
  personsPerBoat: number
): string[] {
  return [
    eventEntryFeeFieldName,
    phoneFieldName,
    swimAgreementFieldName,
    teamNameFieldName,
    ...Array.from({ length: boatsPerTeam }, (_boatValue, boatIndex) => {
      const boatNumber = boatIndex + 1;
      return Array.from({ length: personsPerBoat }, (_value, position) => [
        teamBoatMemberNameFieldName({ boatNumber, boatsPerTeam, position }),
        teamBoatMemberEmailFieldName({ boatNumber, boatsPerTeam, position }),
      ]).flat();
    }).flat(),
    ...questions.map((question) =>
      publicEventRegistrationQuestionFieldName(question.id)
    ),
  ];
}

type PublicEventRegistrationTeamInput = {
  teamName: string;
  boatMembers: {
    boatNumber: number;
    position: number;
    fullName: string;
    email: string;
  }[];
};

function trimmedFormString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);
  return typeof value === 'string' ? value.trim() : '';
}

function parsePublicEventRegistrationTeamFromForm(options: {
  boatsPerTeam: number;
  formData: FormData;
  personsPerBoat: number;
}):
  | { ok: true; team: PublicEventRegistrationTeamInput }
  | {
      ok: false;
      code: 'answers_invalid' | 'questions_required';
      fieldErrors: Record<string, EventRegistrationMutationCode>;
    } {
  const teamName = trimmedFormString(options.formData, teamNameFieldName);
  if (teamName.length === 0) {
    return {
      ok: false,
      code: 'questions_required',
      fieldErrors: { [teamNameFieldName]: 'questions_required' },
    };
  }

  const boatMembers: PublicEventRegistrationTeamInput['boatMembers'] = [];
  const fieldErrors: Record<string, EventRegistrationMutationCode> = {};

  for (
    let boatNumber = 1;
    boatNumber <= options.boatsPerTeam;
    boatNumber += 1
  ) {
    for (let position = 0; position < options.personsPerBoat; position += 1) {
      const nameFieldName = teamBoatMemberNameFieldName({
        boatNumber,
        boatsPerTeam: options.boatsPerTeam,
        position,
      });
      const emailFieldName = teamBoatMemberEmailFieldName({
        boatNumber,
        boatsPerTeam: options.boatsPerTeam,
        position,
      });
      const fullName = trimmedFormString(options.formData, nameFieldName);
      const email = trimmedFormString(options.formData, emailFieldName);
      if (fullName.length === 0 && email.length === 0) {
        continue;
      }
      if (fullName.length === 0 || email.length === 0) {
        fieldErrors[fullName.length === 0 ? nameFieldName : emailFieldName] =
          'questions_required';
        continue;
      }
      if (!emailField.safeParse(email).success) {
        fieldErrors[emailFieldName] = 'answers_invalid';
        continue;
      }
      boatMembers.push({ boatNumber, email, fullName, position });
    }
  }

  if (boatMembers.length === 0) {
    return {
      ok: false,
      code: 'questions_required',
      fieldErrors: {
        [teamBoatMemberNameFieldName({
          boatNumber: 1,
          boatsPerTeam: options.boatsPerTeam,
          position: 0,
        })]: 'questions_required',
      },
    };
  }
  const [firstError] = Object.values(fieldErrors);
  if (firstError) {
    return {
      ok: false,
      code:
        firstError === 'answers_invalid' ? firstError : 'questions_required',
      fieldErrors,
    };
  }
  return { ok: true, team: { boatMembers, teamName } };
}

function publicEventRegistrationSelectedFeeId(options: {
  entryFees: readonly { id: string }[];
  formData: FormData;
}): { ok: true; eventEntryFeeId: string | null } | { ok: false } {
  if (options.entryFees.length === 0) {
    return { ok: true, eventEntryFeeId: null };
  }
  if (options.entryFees.length === 1) {
    const [fee] = options.entryFees;
    if (!fee) {
      return { ok: true, eventEntryFeeId: null };
    }
    return { ok: true, eventEntryFeeId: fee.id };
  }
  const value = options.formData.get(eventEntryFeeFieldName);
  if (
    typeof value === 'string' &&
    options.entryFees.some((fee) => fee.id === value)
  ) {
    return { ok: true, eventEntryFeeId: value };
  }
  return { ok: false };
}

function publicEventRegistrationPhoneFromForm(
  formData: FormData
): string | null {
  const value = formData.get(phoneFieldName);
  if (typeof value !== 'string') {
    return null;
  }
  const phone = value.trim();
  return phone.length > 0 ? phone : null;
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

function mutationCodeFromPrisma(error: unknown): EventRegistrationMutationCode {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025'
  ) {
    return 'not_found';
  }
  return 'unknown';
}

async function publicEventRegistrationAccess(options: {
  callbackUrl: string;
  deniedUrl: string;
  locale: string;
}) {
  const session = await verifySession(options.locale, options.callbackUrl);
  const authContext = appAuthContextFromSession(session);
  if (!authContext) {
    redirect(options.deniedUrl);
  }
  return {
    db: zenstackForAuthContext({
      appRole: Role.USER,
      id: authContext.id,
    }),
    userId: authContext.id,
  };
}

/**
 * Creates or updates the viewer's registration with server-side enforcement.
 *
 * @param locale - Active locale segment.
 * @param slug - Event slug.
 * @param _prevState - Previous form state from the action state hook.
 * @param formData - Submitted registration form data.
 * @returns Form state when validation fails before redirecting.
 */
export async function createPublicEventRegistrationAction(
  locale: string,
  slug: string,
  _prevState: PublicEventRegistrationFormState,
  formData: FormData
): Promise<PublicEventRegistrationFormState> {
  const callbackUrl = `/events/${encodeURIComponent(slug)}/register`;
  const access = await publicEventRegistrationAccess({
    callbackUrl,
    deniedUrl: eventRegistrationErrorUrl(locale, slug, 'not_found'),
    locale,
  });

  const now = new Date();
  let event: {
    id: string;
    requiresPhone: boolean;
    registrationStart: Date | null;
    registrationEnd: Date | null;
    registrationQuestions: {
      id: string;
      required: boolean;
      answerType: EventAnswerType;
      options: Prisma.JsonValue | null;
    }[];
    entryFees: { id: string }[];
    usesTeamRegistration: boolean;
    boatsPerTeam: number;
    personsPerBoat: number;
    allowRepeatTeamCaptain: boolean;
  } | null;
  try {
    event = await access.db.event.findFirst({
      where: { slug },
      select: {
        id: true,
        requiresPhone: true,
        registrationStart: true,
        registrationEnd: true,
        registrationQuestions: {
          orderBy: [{ displayOrder: 'asc' }, { questionText: 'asc' }],
          select: { id: true, required: true, answerType: true, options: true },
        },
        entryFees: {
          orderBy: [{ isDeposit: 'desc' }, { description: 'asc' }],
          select: { id: true },
        },
        usesTeamRegistration: true,
        boatsPerTeam: true,
        personsPerBoat: true,
        allowRepeatTeamCaptain: true,
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
    !isPublicEventRegistrationWindowOpen({
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
  const fieldNames = publicEventRegistrationFieldNames(
    questionsForValidation,
    event.usesTeamRegistration ? event.boatsPerTeam : 0,
    event.usesTeamRegistration ? event.personsPerBoat : 0
  );
  const phone = publicEventRegistrationPhoneFromForm(formData);
  if (event.requiresPhone && phone === null) {
    return publicEventRegistrationFormErrorState({
      code: 'questions_required',
      fieldErrors: { [phoneFieldName]: 'questions_required' },
      fieldNames,
      formData,
    });
  }
  const selectedFee = publicEventRegistrationSelectedFeeId({
    entryFees: event.entryFees,
    formData,
  });
  if (!selectedFee.ok) {
    return publicEventRegistrationFormErrorState({
      code: 'questions_required',
      fieldErrors: { [eventEntryFeeFieldName]: 'questions_required' },
      fieldNames,
      formData,
    });
  }
  const teamRegistration = event.usesTeamRegistration
    ? parsePublicEventRegistrationTeamFromForm({
        boatsPerTeam: event.boatsPerTeam,
        formData,
        personsPerBoat: event.personsPerBoat,
      })
    : null;
  if (teamRegistration && !teamRegistration.ok) {
    return publicEventRegistrationFormErrorState({
      code: teamRegistration.code,
      fieldErrors: teamRegistration.fieldErrors,
      fieldNames,
      formData,
    });
  }
  const swimAgreement = formData.get('swimAgreementAccepted');
  if (swimAgreement !== 'true') {
    return publicEventRegistrationFormErrorState({
      code: 'swim_agreement_required',
      fieldErrors: { [swimAgreementFieldName]: 'swim_agreement_required' },
      fieldNames,
      formData,
    });
  }
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
      fieldNames,
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
            requiresPhone: true,
            usesTeamRegistration: true,
            boatsPerTeam: true,
            personsPerBoat: true,
            allowRepeatTeamCaptain: true,
            registrationStart: true,
            registrationEnd: true,
            entryFees: {
              orderBy: [{ isDeposit: 'desc' }, { description: 'asc' }],
              select: { id: true },
            },
          },
        });
        if (!lockedEvent || !lockedEvent.isPublished) {
          throw new EventRegistrationFlowError('not_found');
        }
        if (
          !isPublicEventRegistrationWindowOpen({
            now,
            registrationStart: lockedEvent.registrationStart,
            registrationEnd: lockedEvent.registrationEnd,
          })
        ) {
          throw new EventRegistrationFlowError('closed');
        }
        if (lockedEvent.requiresPhone && phone === null) {
          throw new EventRegistrationFlowError('questions_required');
        }
        let lockedTeam: PublicEventRegistrationTeamInput | null = null;
        if (lockedEvent.usesTeamRegistration) {
          const lockedTeamRegistration =
            parsePublicEventRegistrationTeamFromForm({
              boatsPerTeam: lockedEvent.boatsPerTeam,
              formData,
              personsPerBoat: lockedEvent.personsPerBoat,
            });
          if (!lockedTeamRegistration.ok) {
            throw new EventRegistrationFlowError(lockedTeamRegistration.code);
          }
          lockedTeam = lockedTeamRegistration.team;
        }
        const lockedSelectedFee = publicEventRegistrationSelectedFeeId({
          entryFees: lockedEvent.entryFees,
          formData,
        });
        if (!lockedSelectedFee.ok) {
          throw new EventRegistrationFlowError('questions_required');
        }
        const status = lockedEvent.requiresApproval
          ? EventRegistrationStatus.pending
          : EventRegistrationStatus.approved;

        const existing = await tx.eventRegistration.findFirst({
          where: { eventId: event.id, userId: access.userId },
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
              phone,
              eventEntryFeeId: lockedSelectedFee.eventEntryFeeId,
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
              userId: access.userId,
              status,
              phone,
              eventEntryFeeId: lockedSelectedFee.eventEntryFeeId,
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
        if (lockedTeam) {
          await tx.eventRegistrationTeam.upsert({
            where: { registrationId },
            create: {
              id: randomUUID(),
              registrationId,
              teamName: lockedTeam.teamName,
              allowRepeatCaptain: lockedEvent.allowRepeatTeamCaptain,
            },
            update: {
              teamName: lockedTeam.teamName,
              allowRepeatCaptain: lockedEvent.allowRepeatTeamCaptain,
            },
          });
          await tx.eventRegistrationBoatMember.deleteMany({
            where: { registrationId },
          });
          await tx.eventRegistrationBoatMember.createMany({
            data: lockedTeam.boatMembers.map((member) => ({
              id: randomUUID(),
              registrationId,
              boatNumber: member.boatNumber,
              position: member.position,
              fullName: member.fullName,
              email: member.email,
            })),
          });
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

/**
 * Cancels the viewer's registrations for the event.
 *
 * @param locale - Active locale segment.
 * @param slug - Event slug.
 * @returns Nothing after redirecting to the event detail page.
 */
export async function cancelPublicEventRegistrationAction(
  locale: string,
  slug: string
): Promise<void> {
  const callbackUrl = `/events/${encodeURIComponent(slug)}`;
  const access = await publicEventRegistrationAccess({
    callbackUrl,
    deniedUrl: eventDetailErrorUrl(locale, slug, 'not_found'),
    locale,
  });
  let event: { id: string } | null;
  try {
    event = await access.db.event.findFirst({
      where: { slug },
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
      where: { eventId: event.id, userId: access.userId },
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
