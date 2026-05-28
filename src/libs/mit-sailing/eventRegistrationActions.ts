'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect, unstable_rethrow } from 'next/navigation';
import * as z from 'zod';
import { Prisma } from '@/generated/prisma/client';
import {
  EventPaymentStatus,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import type { EventAnswerType } from '@/generated/prisma/enums';
import { requireCurrentUser, verifySession } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import { logger } from '@/libs/Logger';
import { getEventPaymentEligibility } from '@/libs/mit-sailing/eventPayments';
import { questionOptionsFromJson } from '@/libs/mit-sailing/eventQueries';
import { parsePublicEventRegistrationAnswersFromForm } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { PublicRegistrationQuestionForValidation } from '@/libs/mit-sailing/eventRegistrationAnswerValidation';
import type { EventRegistrationMutationCode } from '@/libs/mit-sailing/eventRegistrationErrors';
import { isPublicEventRegistrationWindowOpen } from '@/libs/mit-sailing/eventRegistrationWindow';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { zenstackForAuthContext } from '@/libs/zenstack/auth';
import { appAuthContextFromSession } from '@/libs/zenstack/authContext';
import { getI18nPath } from '@/utils/Helpers';
import { normalizeUsPhone } from '@/utils/phoneValidation';

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
  boatMembers: PublicEventRegistrationTeamMemberInput[];
};

type PublicEventRegistrationTeamMemberInput = {
  boatNumber: number;
  position: number;
  fullName: string;
  email: string;
};

type PublicEventRegistrationLockedEvent = {
  id: string;
  isPublished: boolean;
  maxParticipants: number | null;
  requiresApproval: boolean;
  requiresPhone: boolean;
  usesTeamRegistration: boolean;
  boatsPerTeam: number;
  personsPerBoat: number;
  allowRepeatTeamCaptain: boolean;
  registrationStart: Date | null;
  registrationEnd: Date | null;
  entryFees: { amountCents: number; description: string; id: string }[];
  paymentDeadlineAt: Date | null;
  paymentsEnabled: boolean;
};

function trimmedFormString(formData: FormData, fieldName: string): string {
  const value = formData.get(fieldName);
  return typeof value === 'string' ? value.trim() : '';
}

function parsePublicEventRegistrationTeamMemberFromForm(options: {
  boatNumber: number;
  boatsPerTeam: number;
  formData: FormData;
  position: number;
}):
  | { ok: true; member: PublicEventRegistrationTeamMemberInput | null }
  | {
      ok: false;
      code: EventRegistrationMutationCode;
      fieldName: string;
    } {
  const nameFieldName = teamBoatMemberNameFieldName(options);
  const emailFieldName = teamBoatMemberEmailFieldName(options);
  const fullName = trimmedFormString(options.formData, nameFieldName);
  const email = trimmedFormString(options.formData, emailFieldName);

  if (fullName.length === 0 && email.length === 0) {
    return { ok: true, member: null };
  }
  if (fullName.length === 0) {
    return { ok: false, code: 'questions_required', fieldName: nameFieldName };
  }
  if (email.length === 0) {
    return { ok: false, code: 'questions_required', fieldName: emailFieldName };
  }
  if (!emailField.safeParse(email).success) {
    return { ok: false, code: 'answers_invalid', fieldName: emailFieldName };
  }
  return {
    ok: true,
    member: {
      boatNumber: options.boatNumber,
      email,
      fullName,
      position: options.position,
    },
  };
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
      const parsedMember = parsePublicEventRegistrationTeamMemberFromForm({
        boatNumber,
        boatsPerTeam: options.boatsPerTeam,
        formData: options.formData,
        position,
      });
      if (!parsedMember.ok) {
        fieldErrors[parsedMember.fieldName] = parsedMember.code;
        continue;
      }
      if (!parsedMember.member) {
        continue;
      }
      boatMembers.push(parsedMember.member);
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
  const phone = normalizeUsPhone(value);
  return phone.ok ? phone.phone : null;
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

async function syncPublicRegistrationPhoneToProfile(options: {
  phone: string;
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  const profileContact = await options.tx.user.findUnique({
    select: { phone: true },
    where: { id: options.userId },
  });
  if (profileContact?.phone === options.phone) {
    return;
  }
  await options.tx.user.update({
    data: { phone: options.phone },
    where: { id: options.userId },
  });
}

function lockedPublicEventRegistrationContext(options: {
  event: PublicEventRegistrationLockedEvent | null;
  now: Date;
  phone: string | null;
}): {
  event: PublicEventRegistrationLockedEvent;
  phone: string;
} {
  if (!options.event || !options.event.isPublished) {
    throw new EventRegistrationFlowError('not_found');
  }
  if (
    !isPublicEventRegistrationWindowOpen({
      now: options.now,
      registrationStart: options.event.registrationStart,
      registrationEnd: options.event.registrationEnd,
    })
  ) {
    throw new EventRegistrationFlowError('closed');
  }
  if (options.phone === null) {
    throw new EventRegistrationFlowError('questions_required');
  }
  return { event: options.event, phone: options.phone };
}

function parseLockedPublicEventRegistrationTeam(options: {
  event: PublicEventRegistrationLockedEvent;
  formData: FormData;
}): PublicEventRegistrationTeamInput | null {
  if (!options.event.usesTeamRegistration) {
    return null;
  }
  const lockedTeamRegistration = parsePublicEventRegistrationTeamFromForm({
    boatsPerTeam: options.event.boatsPerTeam,
    formData: options.formData,
    personsPerBoat: options.event.personsPerBoat,
  });
  if (!lockedTeamRegistration.ok) {
    throw new EventRegistrationFlowError(lockedTeamRegistration.code);
  }
  return lockedTeamRegistration.team;
}

async function assertPublicEventRegistrationCapacity(options: {
  event: PublicEventRegistrationLockedEvent;
  eventId: string;
  existingRegistrationId: string | null;
  tx: Prisma.TransactionClient;
}) {
  if (options.event.requiresApproval) {
    return;
  }
  const approvedSlotsExcludingSelf = await options.tx.eventRegistration.count({
    where: {
      eventId: options.eventId,
      ...(options.existingRegistrationId
        ? { id: { not: options.existingRegistrationId } }
        : {}),
      status: EventRegistrationStatus.approved,
    },
  });
  if (
    options.event.maxParticipants !== null &&
    approvedSlotsExcludingSelf >= options.event.maxParticipants
  ) {
    throw new EventRegistrationFlowError('full');
  }
}

async function upsertPublicEventRegistration(options: {
  eventEntryFeeId: string | null;
  eventId: string;
  existingRegistrationId: string | null;
  now: Date;
  phone: string;
  registrationId: string;
  status: EventRegistrationStatus;
  tx: Prisma.TransactionClient;
  userId: string;
}) {
  if (options.existingRegistrationId) {
    await options.tx.eventRegistration.update({
      where: { id: options.existingRegistrationId },
      data: {
        status: options.status,
        phone: options.phone,
        eventEntryFeeId: options.eventEntryFeeId,
        swimAgreementAcceptedAt: options.now,
        registrationAnswers: { deleteMany: {} },
      },
    });
    return;
  }
  await options.tx.eventRegistration.create({
    data: {
      id: options.registrationId,
      eventId: options.eventId,
      userId: options.userId,
      status: options.status,
      phone: options.phone,
      eventEntryFeeId: options.eventEntryFeeId,
      createdAt: options.now,
      swimAgreementAcceptedAt: options.now,
    },
  });
}

async function replacePublicEventRegistrationAnswers(options: {
  answers: { questionId: string; value: string }[];
  registrationId: string;
  tx: Prisma.TransactionClient;
}) {
  const answers = options.answers.map((answer) => ({
    id: randomUUID(),
    registrationId: options.registrationId,
    questionId: answer.questionId,
    value: answer.value,
  }));

  if (answers.length > 0) {
    await options.tx.eventRegistrationAnswer.createMany({ data: answers });
  }
}

async function replacePublicEventRegistrationTeam(options: {
  allowRepeatCaptain: boolean;
  registrationId: string;
  team: PublicEventRegistrationTeamInput | null;
  tx: Prisma.TransactionClient;
}) {
  if (!options.team) {
    await options.tx.eventRegistrationBoatMember.deleteMany({
      where: { registrationId: options.registrationId },
    });
    await options.tx.eventRegistrationTeam.deleteMany({
      where: { registrationId: options.registrationId },
    });
    return;
  }
  await options.tx.eventRegistrationTeam.upsert({
    where: { registrationId: options.registrationId },
    create: {
      id: randomUUID(),
      registrationId: options.registrationId,
      teamName: options.team.teamName,
      allowRepeatCaptain: options.allowRepeatCaptain,
    },
    update: {
      teamName: options.team.teamName,
      allowRepeatCaptain: options.allowRepeatCaptain,
    },
  });
  await options.tx.eventRegistrationBoatMember.deleteMany({
    where: { registrationId: options.registrationId },
  });
  await options.tx.eventRegistrationBoatMember.createMany({
    data: options.team.boatMembers.map((member) => ({
      id: randomUUID(),
      registrationId: options.registrationId,
      boatNumber: member.boatNumber,
      position: member.position,
      fullName: member.fullName,
      email: member.email,
    })),
  });
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

function eventCheckoutUrl(locale: string, slug: string): string {
  return getI18nPath(`/events/${encodeURIComponent(slug)}/checkout`, locale);
}

function selectedPaymentEventFee(options: {
  entryFees: { amountCents: number; description: string; id: string }[];
  paymentDeadlineAt: Date | null;
  paymentsEnabled: boolean;
  selectedFeeId: string | null;
}) {
  const eligibility = getEventPaymentEligibility({
    entryFees: options.entryFees,
    paymentDeadlineAt: options.paymentDeadlineAt,
    paymentsEnabled: options.paymentsEnabled,
  });
  if (!eligibility.canCreatePayment) {
    return null;
  }
  return (
    options.entryFees.find(
      (fee) => fee.id === options.selectedFeeId && fee.amountCents > 0
    ) ?? null
  );
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
}): Promise<{ db: ReturnType<typeof zenstackForAuthContext>; userId: string }> {
  await requireCurrentUser(options.locale, options.callbackUrl);
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
  };
  try {
    const eventResult = await access.db.event.findFirst({
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
    if (!eventResult) {
      redirect(eventRegistrationErrorUrl(locale, slug, 'not_found'));
    }
    event = eventResult;
  } catch (error: unknown) {
    unstable_rethrow(error);
    logPublicEventRegistrationFailure({ action: 'load-event', error, slug });
    redirect(
      eventRegistrationErrorUrl(locale, slug, mutationCodeFromPrisma(error))
    );
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
  if (phone === null) {
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

  let redirectToCheckout = false;
  try {
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
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
            paymentDeadlineAt: true,
            paymentsEnabled: true,
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
              select: { amountCents: true, description: true, id: true },
            },
          },
        });
        const lockedContext = lockedPublicEventRegistrationContext({
          event: lockedEvent,
          now,
          phone,
        });
        const lockedTeam = parseLockedPublicEventRegistrationTeam({
          event: lockedContext.event,
          formData,
        });
        const lockedSelectedFee = publicEventRegistrationSelectedFeeId({
          entryFees: lockedContext.event.entryFees,
          formData,
        });
        if (!lockedSelectedFee.ok) {
          throw new EventRegistrationFlowError('questions_required');
        }
        const status = lockedContext.event.requiresApproval
          ? EventRegistrationStatus.pending
          : EventRegistrationStatus.approved;

        const existing = await tx.eventRegistration.findFirst({
          where: { eventId: event.id, userId: access.userId },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
        });
        // Pending applications do not consume accepted capacity; only gate new
        // auto-approved registrations when every seat already has an approval.
        await assertPublicEventRegistrationCapacity({
          event: lockedContext.event,
          eventId: event.id,
          existingRegistrationId: existing?.id ?? null,
          tx,
        });

        const registrationId = existing?.id ?? randomUUID();
        await upsertPublicEventRegistration({
          eventEntryFeeId: lockedSelectedFee.eventEntryFeeId,
          eventId: event.id,
          existingRegistrationId: existing?.id ?? null,
          now,
          phone: lockedContext.phone,
          registrationId,
          status,
          tx,
          userId: access.userId,
        });
        await syncPublicRegistrationPhoneToProfile({
          phone: lockedContext.phone,
          tx,
          userId: access.userId,
        });
        await replacePublicEventRegistrationAnswers({
          answers: parsedAnswers.answers,
          registrationId,
          tx,
        });
        await replacePublicEventRegistrationTeam({
          allowRepeatCaptain: lockedContext.event.allowRepeatTeamCaptain,
          registrationId,
          team: lockedTeam,
          tx,
        });
        const paymentFee = selectedPaymentEventFee({
          ...lockedContext.event,
          selectedFeeId: lockedSelectedFee.eventEntryFeeId,
        });
        if (
          status === EventRegistrationStatus.approved &&
          paymentFee !== null
        ) {
          await tx.eventPayment.upsert({
            create: {
              amountCents: paymentFee.amountCents,
              currency: 'usd',
              eventId: event.id,
              id: randomUUID(),
              registrationId,
              selectedFeeDescription: paymentFee.description,
              selectedFeeId: paymentFee.id,
              status: EventPaymentStatus.pending,
              userId: access.userId,
            },
            update: {},
            where: { registrationId },
          });
          return { redirectToCheckout: true };
        }
        return { redirectToCheckout: false };
      },
      {
        maxWait: 5000,
        timeout: 10_000,
      }
    );
    ({ redirectToCheckout } = result);
  } catch (error: unknown) {
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
  redirect(
    redirectToCheckout
      ? eventCheckoutUrl(locale, slug)
      : getI18nPath(`/events/${encodeURIComponent(slug)}`, locale)
  );
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
  let event: { id: string };
  try {
    const eventResult = await access.db.event.findFirst({
      where: { slug },
      select: { id: true },
    });
    if (!eventResult) {
      redirect(eventDetailErrorUrl(locale, slug, 'not_found'));
    }
    event = eventResult;
  } catch (error: unknown) {
    unstable_rethrow(error);
    logPublicEventRegistrationFailure({
      action: 'load-cancel-event',
      error,
      slug,
    });
    redirect(eventDetailErrorUrl(locale, slug, mutationCodeFromPrisma(error)));
  }
  try {
    await prisma.$transaction(async (tx) => {
      await tx.eventRegistration.updateMany({
        where: { eventId: event.id, userId: access.userId },
        data: { status: EventRegistrationStatus.cancelled },
      });
      await tx.eventPayment.updateMany({
        where: {
          eventId: event.id,
          userId: access.userId,
          status: {
            in: [
              EventPaymentStatus.checkout_created,
              EventPaymentStatus.past_due,
              EventPaymentStatus.pending,
            ],
          },
        },
        data: { status: EventPaymentStatus.cancelled },
      });
    });
  } catch (error: unknown) {
    unstable_rethrow(error);
    logPublicEventRegistrationFailure({ action: 'cancel', error, slug });
    redirect(eventDetailErrorUrl(locale, slug, mutationCodeFromPrisma(error)));
  }

  revalidatePath(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
  redirect(getI18nPath(`/events/${encodeURIComponent(slug)}`, locale));
}
