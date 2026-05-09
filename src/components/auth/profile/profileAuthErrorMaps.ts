type EmailErrorKeys =
  | 'email_exists_error'
  | 'email_invalid_password_error'
  | 'email_invalid_code_error'
  | 'email_code_expired_error'
  | 'email_code_attempts_error'
  | 'email_rate_limited_error'
  | 'email_validation_error';

type PasswordErrorKeys =
  | 'password_pwned_error'
  | 'password_invalid_error'
  | 'password_rate_limited'
  | 'password_change_error';

type DeleteErrorKeys =
  | 'delete_invalid_password_error'
  | 'delete_rate_limited_error'
  | 'delete_validation_error';

/**
 * Maps Better Auth change-password error codes to user-facing copy.
 *
 * @param code - Better Auth error code when present
 * @param _message - Raw provider message, intentionally not surfaced.
 * @param t - Namespace lookup for password error strings
 * @returns Localized error line
 */
export function mapProfilePasswordError(
  code: string | undefined,
  _message: string | undefined,
  t: (key: PasswordErrorKeys) => string
): string {
  if (code === 'PASSWORD_COMPROMISED') {
    return t('password_pwned_error');
  }
  if (code === 'INVALID_PASSWORD' || code === 'INVALID_EMAIL_OR_PASSWORD') {
    return t('password_invalid_error');
  }
  if (code === 'TOO_MANY_REQUESTS') {
    return t('password_rate_limited');
  }
  return t('password_change_error');
}

/**
 * Maps Better Auth change-email error codes to user-facing copy.
 *
 * @param code - Better Auth error code when present
 * @param _message - Raw provider message, intentionally not surfaced.
 * @param t - Namespace lookup for email error strings
 * @returns Localized error line
 */
export function mapProfileEmailError(
  code: string | undefined,
  _message: string | undefined,
  t: (key: EmailErrorKeys) => string
): string {
  if (code === 'EMAIL_EXISTS') {
    return t('email_exists_error');
  }
  if (code === 'INVALID_PASSWORD') {
    return t('email_invalid_password_error');
  }
  if (code === 'INVALID_OTP') {
    return t('email_invalid_code_error');
  }
  if (code === 'OTP_EXPIRED') {
    return t('email_code_expired_error');
  }
  if (code === 'TOO_MANY_ATTEMPTS') {
    return t('email_code_attempts_error');
  }
  if (code === 'TOO_MANY_REQUESTS') {
    return t('email_rate_limited_error');
  }
  return t('email_validation_error');
}

/**
 * Maps Better Auth delete-user error codes to user-facing copy.
 *
 * @param code - Better Auth error code when present
 * @param _message - Raw provider message, intentionally not surfaced.
 * @param t - Namespace lookup for delete error strings
 * @returns Localized error line
 */
export function mapProfileDeleteError(
  code: string | undefined,
  _message: string | undefined,
  t: (key: DeleteErrorKeys) => string
): string {
  if (code === 'INVALID_PASSWORD' || code === 'INVALID_EMAIL_OR_PASSWORD') {
    return t('delete_invalid_password_error');
  }
  if (code === 'TOO_MANY_REQUESTS') {
    return t('delete_rate_limited_error');
  }
  return t('delete_validation_error');
}
