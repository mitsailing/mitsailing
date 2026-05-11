export type CatalogFieldErrors = Record<string, string>;

export type CatalogFieldErrorsParseOptions = Readonly<{
  /** Used when the URL only lists a field name (legacy); should be translated. */
  legacyFieldMessage?: string;
}>;

const LEGACY_FIELD_NAME_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

function isBlockedFieldName(field: string): boolean {
  return (
    field === '__proto__' || field === 'constructor' || field === 'prototype'
  );
}

function isLikelyLegacyCatalogFieldName(raw: string): boolean {
  return LEGACY_FIELD_NAME_PATTERN.test(raw) && !isBlockedFieldName(raw);
}

function isJsonObjectRecord(
  value: unknown
): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseFieldErrorSearchParam(
  raw: string
): { field: string; message: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.startsWith('{')) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(trimmed);
    if (!isJsonObjectRecord(value)) {
      return null;
    }
    const field = value.f;
    const message = value.m;
    if (typeof field !== 'string' || typeof message !== 'string') {
      return null;
    }
    if (!field || isBlockedFieldName(field)) {
      return null;
    }
    return { field, message };
  } catch {
    return null;
  }
}

/**
 * Builds field-level error map from repeated `fieldError` query params.
 *
 * New redirects encode each entry as JSON `{"f":"title","m":"…message…"}`.
 * Legacy URLs used bare field names only; pass {@link CatalogFieldErrorsParseOptions.legacyFieldMessage}
 * so those still show a translated hint instead of the removed `'true'` placeholder.
 *
 * @param fieldError - One or more encoded field error strings from the URL
 * @param options - Optional legacy fallback message for bare field names
 * @returns Field-to-message map when any entries parse, otherwise `undefined`
 */
export function catalogFieldErrorsFromSearchParam(
  fieldError: string | string[] | undefined,
  options?: CatalogFieldErrorsParseOptions
): CatalogFieldErrors | undefined {
  if (!fieldError) {
    return undefined;
  }

  const fields = Array.isArray(fieldError) ? fieldError : [fieldError];
  const fieldErrors: CatalogFieldErrors = {};
  const legacyFallback = options?.legacyFieldMessage;

  for (const raw of fields) {
    if (!raw) {
      continue;
    }

    const parsed = parseFieldErrorSearchParam(raw);
    if (parsed) {
      fieldErrors[parsed.field] = parsed.message;
      continue;
    }

    if (!legacyFallback || !isLikelyLegacyCatalogFieldName(raw)) {
      continue;
    }

    fieldErrors[raw] = legacyFallback;
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}
