type AssocBannerKey =
  | 'assoc_error_duplicate_link'
  | 'form_error_unknown'
  | 'form_error_validation_failed';

/**
 * Maps `?error=` query values from sailing-class association server actions to
 * user-visible banner copy (`AdminCatalogResource` keys only).
 *
 * @param errorCode - Raw query param when present
 * @param translate - `getTranslations({ namespace: 'AdminCatalogResource' })`
 * @returns Message text or `null` when there is no error to show
 */
export function sailingClassAssocQueryErrorMessage(
  errorCode: string | undefined,
  translate: (key: AssocBannerKey) => string
): string | null {
  if (errorCode === 'validation_failed') {
    return translate('form_error_validation_failed');
  }
  if (errorCode === 'duplicate_link') {
    return translate('assoc_error_duplicate_link');
  }
  if (errorCode) {
    return translate('form_error_unknown');
  }
  return null;
}
