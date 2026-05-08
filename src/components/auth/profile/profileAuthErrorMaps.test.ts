import { describe, expect, it } from 'vitest';
import {
  mapProfileDeleteError,
  mapProfileEmailError,
  mapProfilePasswordError,
} from './profileAuthErrorMaps';

function t(key: string) {
  return `translated:${key}`;
}

describe('profile auth error maps', () => {
  it('profile owner gets password guidance for known password errors', () => {
    expect(mapProfilePasswordError('PASSWORD_COMPROMISED', undefined, t)).toBe(
      'translated:password_pwned_error'
    );
    expect(mapProfilePasswordError('INVALID_PASSWORD', undefined, t)).toBe(
      'translated:password_invalid_error'
    );
    expect(
      mapProfilePasswordError('INVALID_EMAIL_OR_PASSWORD', undefined, t)
    ).toBe('translated:password_invalid_error');
    expect(mapProfilePasswordError('TOO_MANY_REQUESTS', undefined, t)).toBe(
      'translated:password_rate_limited'
    );
  });

  it('profile owner gets fallback password guidance for unknown password errors', () => {
    expect(mapProfilePasswordError('UNKNOWN', 'Raw message', t)).toBe(
      'Raw message'
    );
    expect(mapProfilePasswordError(undefined, undefined, t)).toBe(
      'translated:password_change_error'
    );
  });

  it('email-change persona gets guidance for known email errors', () => {
    expect(mapProfileEmailError('EMAIL_EXISTS', undefined, t)).toBe(
      'translated:email_exists_error'
    );
    expect(mapProfileEmailError('INVALID_PASSWORD', undefined, t)).toBe(
      'translated:email_invalid_password_error'
    );
    expect(mapProfileEmailError('INVALID_OTP', undefined, t)).toBe(
      'translated:email_invalid_code_error'
    );
    expect(mapProfileEmailError('OTP_EXPIRED', undefined, t)).toBe(
      'translated:email_code_expired_error'
    );
    expect(mapProfileEmailError('TOO_MANY_ATTEMPTS', undefined, t)).toBe(
      'translated:email_code_attempts_error'
    );
    expect(mapProfileEmailError('TOO_MANY_REQUESTS', undefined, t)).toBe(
      'translated:email_rate_limited_error'
    );
  });

  it('email-change persona gets fallback guidance for unknown email errors', () => {
    expect(mapProfileEmailError('UNKNOWN', 'Raw message', t)).toBe(
      'Raw message'
    );
    expect(mapProfileEmailError(undefined, undefined, t)).toBe(
      'translated:email_validation_error'
    );
  });

  it('profile owner gets delete-account guidance for known delete errors', () => {
    expect(mapProfileDeleteError('INVALID_PASSWORD', undefined, t)).toBe(
      'translated:delete_invalid_password_error'
    );
    expect(
      mapProfileDeleteError('INVALID_EMAIL_OR_PASSWORD', undefined, t)
    ).toBe('translated:delete_invalid_password_error');
    expect(mapProfileDeleteError('TOO_MANY_REQUESTS', undefined, t)).toBe(
      'translated:delete_rate_limited_error'
    );
  });

  it('profile owner gets fallback guidance for unknown delete errors', () => {
    expect(mapProfileDeleteError('UNKNOWN', 'Raw message', t)).toBe(
      'Raw message'
    );
    expect(mapProfileDeleteError(undefined, undefined, t)).toBe(
      'translated:delete_validation_error'
    );
  });
});
