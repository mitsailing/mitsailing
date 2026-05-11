import type messages from '@/locales/en.json';

/**
 * Result codes returned by public event registration mutations. The matching
 * messages live under the `MitSailingEvents` namespace in {@link src/locales}.
 */
export type EventRegistrationMutationCode =
  | 'answers_invalid'
  | 'closed'
  | 'full'
  | 'not_found'
  | 'questions_required'
  | 'swim_agreement_required'
  | 'unknown';

const EVENT_REGISTRATION_MUTATION_CODES = [
  'answers_invalid',
  'closed',
  'full',
  'not_found',
  'questions_required',
  'swim_agreement_required',
  'unknown',
] as const satisfies readonly EventRegistrationMutationCode[];

/**
 * Bound to the real `MitSailingEvents` namespace keys so renaming a translation
 * in `en.json` surfaces as a compile error here rather than a runtime miss.
 * Mirrors the project's `keyof typeof messages.<Namespace>` convention used in
 * `src/libs/admin/catalog/types.ts`.
 */
const EVENT_REGISTRATION_MUTATION_MESSAGE_KEYS = {
  answers_invalid: 'registration_error_answers_invalid',
  closed: 'registration_error_closed',
  full: 'registration_error_full',
  not_found: 'registration_error_not_found',
  questions_required: 'registration_error_questions_required',
  swim_agreement_required: 'registration_error_swim_agreement_required',
  unknown: 'registration_error_unknown',
} as const satisfies Record<
  EventRegistrationMutationCode,
  keyof typeof messages.MitSailingEvents
>;

/** Translation keys consumed by {@link eventRegistrationErrorMessage}. */
export type EventRegistrationMessageKey =
  (typeof EVENT_REGISTRATION_MUTATION_MESSAGE_KEYS)[EventRegistrationMutationCode];

/**
 * Minimal callable shape required to translate registration error messages.
 * The `MitSailingEvents` translator returned by `getTranslations` /
 * `useTranslations` satisfies this structurally, so call sites pass it through
 * without casts.
 */
export type EventRegistrationErrorTranslator = (
  key: EventRegistrationMessageKey
) => string;

/**
 * Narrows an arbitrary search-param string to a known mutation code so callers
 * do not need to repeat the union literal list.
 *
 * @param code - Raw value from a URL search param or form field.
 * @returns The matched mutation code, or `null` when the value is unknown.
 */
export function parseEventRegistrationMutationCode(
  code?: string | null
): EventRegistrationMutationCode | null {
  if (code === null || code === undefined) {
    return null;
  }
  const match = EVENT_REGISTRATION_MUTATION_CODES.find(
    (candidate) => candidate === code
  );
  return match ?? null;
}

/**
 * Looks up the translation key for a public event registration mutation code.
 * Exported as a pure mapping so the lookup table stays unit-testable without
 * mocking the `next-intl` translator.
 *
 * @param code - Mutation code, raw search-param string, or `null`/`undefined`.
 * @returns The `MitSailingEvents` message key, or `null` when the code is unknown.
 */
export function eventRegistrationErrorMessageKey(
  code?: string | null
): EventRegistrationMessageKey | null {
  const known = parseEventRegistrationMutationCode(code);
  return known === null
    ? null
    : EVENT_REGISTRATION_MUTATION_MESSAGE_KEYS[known];
}

/**
 * Resolves a translated message for a public event registration mutation code.
 * Centralised so the page and inline CTA stay aligned when codes are added.
 *
 * @param code - Mutation code, raw search-param string, or `null`/`undefined`.
 * @param t - `MitSailingEvents` translator from `getTranslations` / `useTranslations`.
 * @returns The localised error message, or `null` when the code is unknown.
 */
export function eventRegistrationErrorMessage(
  code: string | null | undefined,
  t: EventRegistrationErrorTranslator
): string | null {
  const key = eventRegistrationErrorMessageKey(code);
  return key === null ? null : t(key);
}
