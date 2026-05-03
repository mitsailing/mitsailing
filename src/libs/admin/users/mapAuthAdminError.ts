import { APIError } from 'better-auth';

/**
 * Maps Better Auth admin API errors to stable query codes for redirects.
 *
 * @param error - Thrown value from `auth.api.*`
 * @returns Stable error code for `?error=`
 */
export function mapAuthAdminErrorToCode(error: unknown): string {
  if (!(error instanceof APIError)) {
    return 'unknown';
  }
  const code =
    typeof error.body?.code === 'string' ? error.body.code : undefined;
  if (!code) {
    return 'unknown';
  }
  switch (code) {
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
    case 'USER_ALREADY_EXISTS': {
      return 'duplicate_email';
    }
    case 'YOU_CANNOT_REMOVE_YOURSELF': {
      return 'cannot_remove_self';
    }
    case 'YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS':
    case 'YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS':
    case 'YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS':
    case 'YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD': {
      return 'not_allowed';
    }
    case 'NO_DATA_TO_UPDATE': {
      return 'no_data_to_update';
    }
    case 'PASSWORD_COMPROMISED': {
      return 'password_compromised';
    }
    default: {
      return 'unknown';
    }
  }
}
