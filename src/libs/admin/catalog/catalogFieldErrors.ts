export type CatalogFieldErrors = Record<string, string>;

export function catalogFieldErrorsFromSearchParam(
  fieldError: string | string[] | undefined
): CatalogFieldErrors | undefined {
  if (!fieldError) {
    return undefined;
  }

  const fields = Array.isArray(fieldError) ? fieldError : [fieldError];
  const fieldErrors: CatalogFieldErrors = {};
  for (const field of fields) {
    fieldErrors[field] = 'true';
  }

  return fieldErrors;
}
