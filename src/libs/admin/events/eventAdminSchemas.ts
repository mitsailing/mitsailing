import * as z from 'zod';
import {
  EventAnswerType,
  EventDetailPageKind,
  EventRegistrationStatus,
} from '@/generated/prisma/enums';
import { instantForNyWallClock } from '@/lib/mit-sailing/nyTime';

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

export function splitEventAdminCsv(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

export function dollarsToEventAdminCents(input: string): number | null {
  const normalized = input.trim().replaceAll(',', '');
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export function eventAdminCentsToDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

const easternDateTimeLocalFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});

export function formatEasternDateTimeLocal(date: Date | null): string {
  if (!date) {
    return '';
  }
  const parts = easternDateTimeLocalFormatter.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get(
    'minute'
  )}`;
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

const optionalPositiveIntSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : Number(value)))
  .pipe(z.number().int().positive().nullable());

const eventDetailPageKindSchema = z.enum([
  EventDetailPageKind.standard,
  EventDetailPageKind.external,
]);

const eventAnswerTypeSchema = z.enum([
  EventAnswerType.text,
  EventAnswerType.select,
  EventAnswerType.checkbox,
]);

export const eventAdminBasicsFormSchema = z
  .object({
    name: z.string().trim().min(1),
    shortName: z.string().trim(),
    slug: z.string().trim(),
    eventCategoryId: z.string().trim().min(1),
    description: z.string().trim(),
    isSpecial: z.boolean(),
    requiresApproval: z.boolean(),
    maxParticipants: optionalPositiveIntSchema,
    registrationStart: optionalDateTimeLocalSchema,
    registrationEnd: optionalDateTimeLocalSchema,
    detailPageKind: eventDetailPageKindSchema,
    externalDetailUrl: z.string().trim(),
    internalNotes: z.string().trim(),
    isPublished: z.boolean(),
  })
  .transform((value) => {
    const slug = slugifyEventAdmin(value.slug || value.name);
    return {
      ...value,
      shortName: value.shortName || value.name,
      slug,
      externalDetailUrl:
        value.detailPageKind === EventDetailPageKind.external
          ? value.externalDetailUrl
          : '',
    };
  })
  .refine((value) => value.slug.length > 0, { path: ['slug'] })
  .refine(
    (value) =>
      value.detailPageKind !== EventDetailPageKind.external ||
      z.url().safeParse(value.externalDetailUrl).success,
    { path: ['externalDetailUrl'] }
  )
  .refine(
    (value) =>
      !value.registrationStart ||
      !value.registrationEnd ||
      value.registrationEnd.getTime() > value.registrationStart.getTime(),
    { path: ['registrationEnd'] }
  );

export const eventDateFormSchema = z
  .object({
    startDateTime: requiredDateTimeLocalSchema,
    endDateTime: requiredDateTimeLocalSchema,
  })
  .refine(
    (value) => value.endDateTime.getTime() > value.startDateTime.getTime(),
    { path: ['endDateTime'] }
  );

export const eventQuestionFormSchema = z
  .object({
    questionText: z.string().trim().min(1),
    answerType: eventAnswerTypeSchema,
    optionsCsv: z.string().trim(),
    required: z.boolean(),
    displayOrder: optionalPositiveIntSchema,
  })
  .transform((value) => ({
    ...value,
    displayOrder: value.displayOrder ?? 0,
    options:
      value.answerType === EventAnswerType.select
        ? splitEventAdminCsv(value.optionsCsv)
        : [],
  }))
  .refine(
    (value) =>
      value.answerType !== EventAnswerType.select || value.options.length > 0,
    { path: ['optionsCsv'] }
  );

export const eventFeeFormSchema = z.object({
  description: z.string().trim().min(1),
  amountCents: z
    .string()
    .trim()
    .refine((value) => dollarsToEventAdminCents(value) !== null)
    .transform((value) => dollarsToEventAdminCents(value) ?? 0),
  isDeposit: z.boolean(),
});

export const eventRegistrationStatusFormSchema = z.object({
  status: z.enum([
    EventRegistrationStatus.pending,
    EventRegistrationStatus.approved,
    EventRegistrationStatus.cancelled,
  ]),
});

export function rawEventBasicsFromFormData(formData: FormData): unknown {
  return {
    name: formString(formData, 'name'),
    shortName: formString(formData, 'shortName'),
    slug: formString(formData, 'slug'),
    eventCategoryId: formString(formData, 'eventCategoryId'),
    description: formString(formData, 'description'),
    isSpecial: formCheckbox(formData, 'isSpecial'),
    requiresApproval: formCheckbox(formData, 'requiresApproval'),
    maxParticipants: formString(formData, 'maxParticipants'),
    registrationStart: formString(formData, 'registrationStart'),
    registrationEnd: formString(formData, 'registrationEnd'),
    detailPageKind: formString(formData, 'detailPageKind'),
    externalDetailUrl: formString(formData, 'externalDetailUrl'),
    internalNotes: formString(formData, 'internalNotes'),
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
    optionsCsv: formString(formData, 'optionsCsv'),
    required: formCheckbox(formData, 'required'),
    displayOrder: formString(formData, 'displayOrder'),
  };
}

export function rawEventFeeFromFormData(formData: FormData): unknown {
  return {
    description: formString(formData, 'description'),
    amountCents: formString(formData, 'amountCents'),
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
