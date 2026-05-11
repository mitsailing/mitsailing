import 'server-only';
import { z } from 'zod';
import { EventAnswerType } from '@/generated/prisma/enums';

/** Matches `@db.Text` practical limit for abuse resistance. */
export const MAX_EVENT_REGISTRATION_TEXT_ANSWER_LENGTH = 10_000;

const registrationTextBodySchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_EVENT_REGISTRATION_TEXT_ANSWER_LENGTH);

/**
 * At most one hidden `false` and one checkbox `true` (`max(2)` + one `true` max).
 */
const checkboxBooleanFormEntriesSchema = z
  .array(z.enum(['true', 'false']))
  .max(2)
  .refine((entries) => entries.filter((v) => v === 'true').length <= 1, {
    message: 'boolean_checkbox_at_most_one_true',
  });

export type PublicRegistrationQuestionForValidation = {
  id: string;
  required: boolean;
  answerType: EventAnswerType;
  options: string[];
};

export type ParsedPublicRegistrationAnswers =
  | {
      ok: true;
      answers: { questionId: string; value: string }[];
    }
  | { ok: false; code: 'questions_required' | 'answers_invalid' };

type AnswerSlice =
  | { status: 'skip' }
  | { status: 'persist'; value: string }
  | { status: 'fail'; code: 'questions_required' | 'answers_invalid' };

function assertNever(_value: never): AnswerSlice {
  return { status: 'fail', code: 'answers_invalid' };
}

function selectValueSchema(options: string[]) {
  return z
    .string()
    .trim()
    .min(1)
    .refine((opt) => options.includes(opt), { message: 'invalid_option' });
}

function textAnswerSlice(
  question: PublicRegistrationQuestionForValidation,
  field: string,
  formData: FormData
): AnswerSlice {
  const raw = formData.get(field);
  if (raw === null || raw === '') {
    if (question.required) {
      return { status: 'fail', code: 'questions_required' };
    }
    return { status: 'skip' };
  }
  if (typeof raw !== 'string') {
    return { status: 'fail', code: 'answers_invalid' };
  }
  const parsedText = registrationTextBodySchema.safeParse(raw);
  if (!parsedText.success) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  return { status: 'persist', value: parsedText.data };
}

function selectAnswerSlice(
  question: PublicRegistrationQuestionForValidation,
  field: string,
  formData: FormData
): AnswerSlice {
  const raw = formData.get(field);
  if (raw === null || raw === '') {
    if (question.required) {
      return { status: 'fail', code: 'questions_required' };
    }
    return { status: 'skip' };
  }
  if (typeof raw !== 'string') {
    return { status: 'fail', code: 'answers_invalid' };
  }
  if (question.options.length === 0) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  const parsedSelect = selectValueSchema(question.options).safeParse(raw);
  if (!parsedSelect.success) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  return { status: 'persist', value: parsedSelect.data };
}

function checkboxBooleanSlice(
  question: PublicRegistrationQuestionForValidation,
  fieldName: string,
  formData: FormData
): AnswerSlice {
  // `FormData.get` returns only the first value per name; unchecked+hidden and
  // checked+hidden both need `getAll` (Next.js / React form actions pass through
  // the same `FormData` as the browser builds from the form).
  const rawAll = formData.getAll(fieldName);
  const strings = rawAll.filter(
    (entry): entry is string => typeof entry === 'string'
  );
  if (strings.length !== rawAll.length) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  const parsedEntries = checkboxBooleanFormEntriesSchema.safeParse(strings);
  if (!parsedEntries.success) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  const entries = parsedEntries.data;
  if (entries.includes('true')) {
    return { status: 'persist', value: 'true' };
  }
  if (question.required) {
    return { status: 'fail', code: 'questions_required' };
  }
  return { status: 'skip' };
}

function checkboxMultiSlice(
  question: PublicRegistrationQuestionForValidation,
  fieldName: string,
  formData: FormData
): AnswerSlice {
  const rawAll = formData.getAll(fieldName);
  const strings = rawAll.filter(
    (entry): entry is string => typeof entry === 'string'
  );
  if (strings.length !== rawAll.length) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  if (strings.length === 0) {
    if (question.required) {
      return { status: 'fail', code: 'questions_required' };
    }
    return { status: 'skip' };
  }
  const unique = [...new Set(strings)];
  if (unique.some((value) => !question.options.includes(value))) {
    return { status: 'fail', code: 'answers_invalid' };
  }
  unique.sort((a, b) => a.localeCompare(b));
  return { status: 'persist', value: JSON.stringify(unique) };
}

function checkboxAnswerSlice(
  question: PublicRegistrationQuestionForValidation,
  field: string,
  formData: FormData
): AnswerSlice {
  if (question.options.length === 0) {
    return checkboxBooleanSlice(question, field, formData);
  }
  return checkboxMultiSlice(question, field, formData);
}

function answerSliceForQuestion(
  question: PublicRegistrationQuestionForValidation,
  formData: FormData
): AnswerSlice {
  const field = `question_${question.id}`;
  if (question.answerType === EventAnswerType.text) {
    return textAnswerSlice(question, field, formData);
  }
  if (question.answerType === EventAnswerType.select) {
    return selectAnswerSlice(question, field, formData);
  }
  if (question.answerType === EventAnswerType.checkbox) {
    return checkboxAnswerSlice(question, field, formData);
  }
  return assertNever(question.answerType);
}

/**
 * Validates registration question answers from a public form and returns rows
 * safe to persist. Uses {@link https://github.com/colinhacks/zod Zod}
 * {@link z.ZodSchema.safeParse safeParse} for text, select, and boolean checkbox
 * entries (per Next.js server-validation patterns).
 * Duplicate `name` values (hidden + checkbox) must be read with
 * {@link https://developer.mozilla.org/en-US/docs/Web/API/FormData/getAll FormData.getAll},
 * not `get()`, which returns only the first value.
 *
 * @param questions - Questions in display order with normalized option strings
 * @param formData - Submitted multipart body
 * @returns Parsed answers or a failure code
 */
export function parsePublicEventRegistrationAnswersFromForm(
  questions: PublicRegistrationQuestionForValidation[],
  formData: FormData
): ParsedPublicRegistrationAnswers {
  const answers: { questionId: string; value: string }[] = [];

  for (const question of questions) {
    const slice = answerSliceForQuestion(question, formData);
    if (slice.status === 'fail') {
      return { ok: false, code: slice.code };
    }
    if (slice.status === 'persist') {
      answers.push({ questionId: question.id, value: slice.value });
    }
  }

  return { ok: true, answers };
}
