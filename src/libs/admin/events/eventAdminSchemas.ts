import * as z from 'zod';
import {
  EventAnswerType,
  EventAddressPreset,
  EventDetailPageKind,
  EventRegistrationMode,
  EventRegistrationStatus,
  EventSailingCardRequirement,
  LearnToSailManagedClassKind,
} from '@/generated/prisma/enums';
import {
  formatNyDateTimeLocalInput,
  instantForNyWallClock,
} from '@/lib/mit-sailing/nyTime';
import { Role } from '@/libs/auth/roles';
import { sanitizeCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';
import { eventAddressPresetFields } from '@/libs/mit-sailing/eventAddressPresets';
import { parseUsdDecimalStringToMinorUnits } from '@/libs/money/stripeUsdMinorUnits';

export {
  parseUsdDecimalStringToMinorUnits as dollarsToEventAdminCents,
  usdMinorUnitsToDecimalInputString as eventAdminCentsToDollars,
} from '@/libs/money/stripeUsdMinorUnits';

const dateTimeLocalPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value : '';
}

function formCheckbox(formData: FormData, key: string): boolean {
  const values = formData.getAll(key);
  return values.includes('true') || values.includes('on');
}

function formStrings(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function slugifyEventAdmin(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9\s-]/g, '')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-|-$/g, '');
}

type EventAdminSlugDate = Date | { startDateTime: Date };

function eventAdminSlugStartDate(date: EventAdminSlugDate): Date {
  return date instanceof Date ? date : date.startDateTime;
}

function easternDateParts(date: Date): {
  day: string;
  month: string;
  value: string;
  year: string;
} {
  const value = formatNyDateTimeLocalInput(date).slice(0, 10);
  const [year = '', month = '', day = ''] = value.split('-');
  return { day, month, value, year };
}

function eventAdminDatePrefix(dates: readonly EventAdminSlugDate[]): string {
  const dateParts = [
    ...new Map(
      dates
        .map((date) => easternDateParts(eventAdminSlugStartDate(date)))
        .toSorted((left, right) => left.value.localeCompare(right.value))
        .map((date) => [date.value, date])
    ).values(),
  ];
  const [firstDate] = dateParts;
  if (!firstDate) {
    return '';
  }
  if (dateParts.length === 1) {
    return firstDate.value;
  }
  if (
    dateParts.every(
      (date) => date.year === firstDate.year && date.month === firstDate.month
    )
  ) {
    return [
      firstDate.value,
      ...dateParts.slice(1).map((date) => date.day),
    ].join('-');
  }
  if (dateParts.every((date) => date.year === firstDate.year)) {
    return [
      firstDate.value,
      ...dateParts.slice(1).map((date) => `${date.month}-${date.day}`),
    ].join('-');
  }
  return dateParts.map((date) => date.value).join('-');
}

export function generateEventAdminSlug(options: {
  dates: readonly EventAdminSlugDate[];
  name: string;
}): string {
  const nameSlug = slugifyEventAdmin(options.name);
  const datePrefix = eventAdminDatePrefix(options.dates);
  return [datePrefix, nameSlug].filter(Boolean).join('-');
}

export function splitEventAdminOptionLines(input: string): string[] {
  return input
    .split(/\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function formatEasternDateTimeLocal(date: Date | null): string {
  if (!date) {
    return '';
  }
  return formatNyDateTimeLocalInput(date);
}

export function parseEasternDateTimeLocal(value: string): Date | null {
  const match = dateTimeLocalPattern.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  const instant = instantForNyWallClock(year, month, day, hour, minute);
  if (formatEasternDateTimeLocal(instant) !== value.trim()) {
    return null;
  }
  return instant;
}

const optionalDateTimeLocalSchema = z
  .string()
  .trim()
  .refine((value) => value === '' || parseEasternDateTimeLocal(value) !== null)
  .transform((value) =>
    value === ''
      ? null
      : (parseEasternDateTimeLocal(value) ?? new Date(Number.NaN))
  );

const requiredDateTimeLocalSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => parseEasternDateTimeLocal(value) !== null)
  .transform(
    (value) => parseEasternDateTimeLocal(value) ?? new Date(Number.NaN)
  );

/** Trimmed form text: blank → `null`, else `Number()` (pipe validates with `z.int()`). */
const optionalTrimmedNumericStringSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)));

/** Empty field → `null` (no cap); otherwise a safe integer ≥ 1 — never `0`. */
const optionalPositiveIntSchema = optionalTrimmedNumericStringSchema.pipe(
  z.int().positive().nullable()
);

const requiredPositiveIntStringSchema = z
  .union([
    z
      .string()
      .trim()
      .transform((value) => (value === '' ? 1 : Number(value))),
    z.number(),
  ])
  .pipe(z.int().positive())
  .default(1);

/** Blank → `null`; explicit `0` allowed (e.g. display order). */
const optionalNonNegativeIntSchema = optionalTrimmedNumericStringSchema.pipe(
  z.int().nonnegative().nullable()
);

const eventDetailPageKindSchema = z.enum([
  EventDetailPageKind.standard,
  EventDetailPageKind.external,
]);

const eventRegistrationModeSchema = z
  .union([
    z.enum([
      EventRegistrationMode.none,
      EventRegistrationMode.standard,
      EventRegistrationMode.external,
    ]),
    z.literal(''),
  ])
  .default('')
  .transform((value) => value || EventRegistrationMode.standard);

const learnToSailManagedClassKindSchema = z
  .union([
    z.enum([
      LearnToSailManagedClassKind.none,
      LearnToSailManagedClassKind.beginner_mid_week_123,
      LearnToSailManagedClassKind.beginner_sunday_all_in_one,
    ]),
    z.literal(''),
  ])
  .default('')
  .transform((value) => value || LearnToSailManagedClassKind.none);

const eventSailingCardRequirementSchema = z
  .union([
    z.enum([
      EventSailingCardRequirement.NONE,
      EventSailingCardRequirement.CURRENT_CARD,
    ]),
    z.literal(''),
  ])
  .default('')
  .transform((value) => value || EventSailingCardRequirement.NONE);

const eventAnswerTypeSchema = z.enum([
  EventAnswerType.text,
  EventAnswerType.select,
  EventAnswerType.checkbox,
]);

const eventAddressPresetSchema = z.enum([
  EventAddressPreset.pavilion,
  EventAddressPreset.bluewater,
  EventAddressPreset.custom,
]);

const eventAdminExternalHttpUrlSchema = z.httpUrl();
const eventAdminPublicContentSchema = z
  .string()
  .default('')
  .transform((value) => sanitizeCmsRichTextHtml(value));
const eventAdminOptionalPublicNoteSchema = z
  .string()
  .trim()
  .max(160)
  .default('')
  .transform((value) => (value === '' ? null : value));

export const ASSIGNABLE_EVENT_ADMIN_ROLES = [
  Role.VOLUNTEER_INSTRUCTOR,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
  Role.ADMIN,
] as const;

export const eventAdminBasicsFormSchema = z
  .object({
    name: z.string().trim().min(1),
    shortName: z.string().trim(),
    eventCategoryId: z.string().trim().min(1),
    description: eventAdminPublicContentSchema,
    isSpecial: z.boolean(),
    requiresApproval: z.boolean(),
    requiresPhone: z.boolean(),
    usesTeamRegistration: z.boolean().default(false),
    boatsPerTeam: requiredPositiveIntStringSchema,
    personsPerBoat: requiredPositiveIntStringSchema,
    allowRepeatTeamCaptain: z.boolean().default(false),
    maxParticipants: optionalPositiveIntSchema,
    registrationStart: optionalDateTimeLocalSchema,
    registrationEnd: optionalDateTimeLocalSchema,
    detailPageKind: eventDetailPageKindSchema,
    externalDetailUrl: z.string().trim(),
    registrationMode: eventRegistrationModeSchema,
    externalRegistrationUrl: z.string().trim().default(''),
    externalEntriesUrl: z.string().trim().default(''),
    learnToSailManagedClassKind: learnToSailManagedClassKindSchema,
    selectionNote: eventAdminOptionalPublicNoteSchema,
    sailingCardRequirement: eventSailingCardRequirementSchema,
    faqVisible: z.boolean().default(false),
    faqContent: eventAdminPublicContentSchema,
    noticeOfRaceVisible: z.boolean().default(false),
    noticeOfRaceContent: eventAdminPublicContentSchema,
    sailingInstructionsVisible: z.boolean().default(false),
    sailingInstructionsContent: eventAdminPublicContentSchema,
    resultsVisible: z.boolean().default(false),
    resultsContent: eventAdminPublicContentSchema,
    isPublished: z.boolean(),
  })
  .transform((value) => {
    const slug = generateEventAdminSlug({ dates: [], name: value.name });
    return {
      ...value,
      shortName: value.shortName || value.name,
      slug,
      externalDetailUrl:
        value.detailPageKind === EventDetailPageKind.external
          ? value.externalDetailUrl
          : '',
      externalRegistrationUrl:
        value.registrationMode === EventRegistrationMode.external
          ? value.externalRegistrationUrl
          : '',
      externalEntriesUrl:
        value.registrationMode === EventRegistrationMode.external
          ? value.externalEntriesUrl
          : '',
      boatsPerTeam: value.usesTeamRegistration ? value.boatsPerTeam : 1,
      personsPerBoat: value.usesTeamRegistration ? value.personsPerBoat : 1,
      allowRepeatTeamCaptain: value.usesTeamRegistration
        ? value.allowRepeatTeamCaptain
        : false,
    };
  })
  .refine((value) => value.slug.length > 0, { path: ['slug'] })
  .refine(
    (value) =>
      value.detailPageKind !== EventDetailPageKind.external ||
      eventAdminExternalHttpUrlSchema.safeParse(value.externalDetailUrl)
        .success,
    { path: ['externalDetailUrl'] }
  )
  .refine(
    (value) =>
      value.registrationMode !== EventRegistrationMode.external ||
      eventAdminExternalHttpUrlSchema.safeParse(value.externalRegistrationUrl)
        .success,
    { path: ['externalRegistrationUrl'] }
  )
  .refine(
    (value) =>
      value.externalEntriesUrl === '' ||
      eventAdminExternalHttpUrlSchema.safeParse(value.externalEntriesUrl)
        .success,
    { path: ['externalEntriesUrl'] }
  )
  .refine(
    (value) =>
      !value.registrationStart ||
      !value.registrationEnd ||
      value.registrationEnd.getTime() > value.registrationStart.getTime(),
    { path: ['registrationEnd'] }
  )
  .refine(
    (value) =>
      !value.usesTeamRegistration ||
      value.boatsPerTeam > 1 ||
      value.personsPerBoat > 1,
    { path: ['usesTeamRegistration'] }
  )
  .refine(
    (value) =>
      value.learnToSailManagedClassKind === LearnToSailManagedClassKind.none ||
      value.registrationMode === EventRegistrationMode.standard,
    { path: ['learnToSailManagedClassKind'] }
  )
  .refine(
    (value) =>
      value.learnToSailManagedClassKind === LearnToSailManagedClassKind.none ||
      value.requiresApproval,
    { path: ['requiresApproval'] }
  );

export const eventDateFormSchema = z
  .object({
    startDateTime: requiredDateTimeLocalSchema,
    endDateTime: requiredDateTimeLocalSchema,
  })
  .refine(
    (value) =>
      value.startDateTime instanceof Date &&
      value.endDateTime instanceof Date &&
      value.endDateTime.getTime() > value.startDateTime.getTime(),
    { path: ['endDateTime'] }
  );

export const eventQuestionFormSchema = z
  .object({
    questionText: z.string().trim().min(1),
    answerType: eventAnswerTypeSchema,
    optionsText: z.string().trim(),
    required: z.boolean(),
    displayOrder: optionalNonNegativeIntSchema,
  })
  .transform((value) => ({
    ...value,
    options:
      value.answerType === EventAnswerType.select
        ? splitEventAdminOptionLines(value.optionsText)
        : [],
  }))
  .refine(
    (value) =>
      value.answerType !== EventAnswerType.select || value.options.length > 0,
    { path: ['optionsText'] }
  );

/**
 * Zod `custom` issue `params.errorCode` when the fee dollar string does not parse
 * to minor units (`parseUsdDecimalStringToMinorUnits` returns `null`). Zero and
 * negative valid parses are rejected by `z.int().positive()` on the pipe — use
 * {@link isEventAdminInvalidFeeAmountIssue} at the admin boundary for both cases.
 */
const EVENT_ADMIN_INVALID_FEE_AMOUNT_ERROR_CODE =
  'invalid_event_fee_amount' as const;

/**
 * Reads stable `params.errorCode` from a Zod `custom` issue.
 *
 * @param issue - Zod issue-like object with optional custom params
 * @returns Error code from `params.errorCode`, when present
 */
function zodCustomIssueParamsErrorCode(issue: {
  readonly code?: string;
  readonly params?: Record<string, unknown> | undefined;
}): string | undefined {
  if (issue.code !== 'custom') {
    return undefined;
  }
  const candidate = issue.params?.errorCode;
  return typeof candidate === 'string' ? candidate : undefined;
}

/**
 * Whether a Zod issue for `eventFeeFormSchema` should use invalid-fee admin copy
 * (`invalid_event_fee_amount`): unparseable dollar string (`custom` +
 * {@link EVENT_ADMIN_INVALID_FEE_AMOUNT_ERROR_CODE}) or zero / negative cents
 * after parse (`too_small` from `z.int().positive()` on `amountDollars`).
 *
 * @param issue - Raw Zod issue (path may end with `amountDollars`)
 * @returns `true` when the issue maps to invalid fee amount admin copy
 */
export function isEventAdminInvalidFeeAmountIssue(issue: {
  readonly code?: string;
  readonly params?: Record<string, unknown> | undefined;
  readonly path?: readonly PropertyKey[] | undefined;
}): boolean {
  if (
    zodCustomIssueParamsErrorCode(issue) ===
    EVENT_ADMIN_INVALID_FEE_AMOUNT_ERROR_CODE
  ) {
    return true;
  }
  return issue.code === 'too_small' && issue.path?.at(-1) === 'amountDollars';
}

/**
 * Admin fee amount: decimal dollar string → integer cents. Parse failures use a
 * `custom` issue; valid parses must pass `z.int().positive()` (matches Stripe
 * USD `amount` > 0), mirroring the string → `pipe(z.int().positive())` style used
 * for optional max participants in this module.
 */
const eventAdminFeeDollarStringToCentsSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const cents = parseUsdDecimalStringToMinorUnits(value);
    if (cents === null) {
      ctx.addIssue({
        code: 'custom',
        params: { errorCode: EVENT_ADMIN_INVALID_FEE_AMOUNT_ERROR_CODE },
      });
      return z.NEVER;
    }
    return cents;
  })
  .pipe(z.int().positive());

export const eventFeeFormSchema = z
  .object({
    description: z.string().trim().min(1),
    /** Decimal dollars as entered in the admin form (e.g. `150.00`), not integer cents. */
    amountDollars: eventAdminFeeDollarStringToCentsSchema,
    isDeposit: z.boolean(),
  })
  .transform(({ description, amountDollars: amountCents, isDeposit }) => ({
    description,
    amountCents,
    isDeposit,
  }));

export const eventAdminIdsFormSchema = z
  .array(z.string().trim().min(1))
  .min(1)
  .transform((adminUserIds) => [...new Set(adminUserIds)]);

export const eventRegistrationStatusFormSchema = z.object({
  status: z.enum([
    EventRegistrationStatus.pending,
    EventRegistrationStatus.approved,
    EventRegistrationStatus.cancelled,
  ]),
});

export const eventPaymentSettingsFormSchema = z
  .object({
    paymentsEnabled: z.boolean(),
    paymentDeadlineAt: optionalDateTimeLocalSchema,
  })
  .refine(
    (value) => !value.paymentsEnabled || value.paymentDeadlineAt !== null,
    { path: ['paymentDeadlineAt'] }
  );

export const eventLocationFormSchema = z
  .object({
    addressPreset: eventAddressPresetSchema,
    addressName: z.string().trim(),
    addressLine1: z.string().trim(),
    addressLine2: z.string().trim(),
    addressCity: z.string().trim(),
    addressState: z.string().trim(),
    addressPostalCode: z.string().trim(),
    addressCountry: z.string().trim(),
  })
  .transform((value) => {
    const preset = eventAddressPresetFields(value.addressPreset);
    const address = preset ?? value;
    return {
      ...value,
      addressName: address.addressName || null,
      addressLine1: address.addressLine1 || null,
      addressLine2: address.addressLine2 || null,
      addressCity: address.addressCity || null,
      addressState: address.addressState || null,
      addressPostalCode: address.addressPostalCode || null,
      addressCountry: address.addressCountry || null,
    };
  });

export const eventPaymentManualHandledFormSchema = z.object({
  note: z.string().trim().min(1),
});

export function rawEventBasicsFromFormData(formData: FormData): unknown {
  return {
    name: formString(formData, 'name'),
    shortName: formString(formData, 'shortName'),
    eventCategoryId: formString(formData, 'eventCategoryId'),
    description: formString(formData, 'description'),
    isSpecial: formCheckbox(formData, 'isSpecial'),
    requiresApproval: formCheckbox(formData, 'requiresApproval'),
    requiresPhone: formCheckbox(formData, 'requiresPhone'),
    usesTeamRegistration: formCheckbox(formData, 'usesTeamRegistration'),
    boatsPerTeam: formString(formData, 'boatsPerTeam'),
    personsPerBoat: formString(formData, 'personsPerBoat'),
    allowRepeatTeamCaptain: formCheckbox(formData, 'allowRepeatTeamCaptain'),
    maxParticipants: formString(formData, 'maxParticipants'),
    registrationStart: formString(formData, 'registrationStart'),
    registrationEnd: formString(formData, 'registrationEnd'),
    detailPageKind: formString(formData, 'detailPageKind'),
    externalDetailUrl: formString(formData, 'externalDetailUrl'),
    registrationMode: formString(formData, 'registrationMode'),
    externalRegistrationUrl: formString(formData, 'externalRegistrationUrl'),
    externalEntriesUrl: formString(formData, 'externalEntriesUrl'),
    learnToSailManagedClassKind: formString(
      formData,
      'learnToSailManagedClassKind'
    ),
    selectionNote: formString(formData, 'selectionNote'),
    sailingCardRequirement: formString(formData, 'sailingCardRequirement'),
    faqVisible: formCheckbox(formData, 'faqVisible'),
    faqContent: formString(formData, 'faqContent'),
    noticeOfRaceVisible: formCheckbox(formData, 'noticeOfRaceVisible'),
    noticeOfRaceContent: formString(formData, 'noticeOfRaceContent'),
    sailingInstructionsVisible: formCheckbox(
      formData,
      'sailingInstructionsVisible'
    ),
    sailingInstructionsContent: formString(
      formData,
      'sailingInstructionsContent'
    ),
    resultsVisible: formCheckbox(formData, 'resultsVisible'),
    resultsContent: formString(formData, 'resultsContent'),
    isPublished: formCheckbox(formData, 'isPublished'),
  };
}

export function rawEventDateFromFormData(formData: FormData): unknown {
  return {
    startDateTime: formString(formData, 'startDateTime'),
    endDateTime: formString(formData, 'endDateTime'),
  };
}

export function rawEventQuestionFromFormData(formData: FormData): unknown {
  return {
    questionText: formString(formData, 'questionText'),
    answerType: formString(formData, 'answerType'),
    optionsText: formString(formData, 'optionsText'),
    required: formCheckbox(formData, 'required'),
    displayOrder: formString(formData, 'displayOrder'),
  };
}

export function rawEventFeeFromFormData(formData: FormData): unknown {
  return {
    description: formString(formData, 'description'),
    amountDollars: formString(formData, 'amountDollars'),
    isDeposit: formCheckbox(formData, 'isDeposit'),
  };
}

export function rawEventAdminIdsFromFormData(formData: FormData): string[] {
  return formStrings(formData, 'adminUserId');
}

export function rawEventRegistrationStatusFromFormData(
  formData: FormData
): unknown {
  return { status: formString(formData, 'status') };
}

export function rawEventPaymentSettingsFromFormData(
  formData: FormData
): unknown {
  return {
    paymentsEnabled: formCheckbox(formData, 'paymentsEnabled'),
    paymentDeadlineAt: formString(formData, 'paymentDeadlineAt'),
  };
}

export function rawEventLocationFromFormData(formData: FormData): unknown {
  return {
    addressPreset: formString(formData, 'addressPreset'),
    addressName: formString(formData, 'addressName'),
    addressLine1: formString(formData, 'addressLine1'),
    addressLine2: formString(formData, 'addressLine2'),
    addressCity: formString(formData, 'addressCity'),
    addressState: formString(formData, 'addressState'),
    addressPostalCode: formString(formData, 'addressPostalCode'),
    addressCountry: formString(formData, 'addressCountry'),
  };
}

export function rawEventPaymentManualHandledFromFormData(
  formData: FormData
): unknown {
  return { note: formString(formData, 'note') };
}
