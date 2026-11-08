import * as React from 'react';

/**
 * Shared inline styles for auth transactional emails
 * (`verify-email`, `password-reset`, and related notices).
 */

export const section: React.CSSProperties = {
  padding: '28px 24px',
};

export const heading: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 600,
  margin: '0 0 16px',
};

export const paragraph: React.CSSProperties = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '22px',
  margin: '0 0 20px',
};

/** Muted line below the primary action (expiry text). */
export const supportFooter: React.CSSProperties = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0',
};

/**
 * Replaces auth email placeholders in localized copy.
 *
 * @param message - Template string containing `{email}` or `{url}` tokens.
 * @param values - Optional replacement values for the supported tokens.
 * @returns The message with supported placeholders replaced.
 */
export function replaceAuthEmailValues(
  message: string,
  values: { email?: string; url?: string }
): string {
  return message
    .replaceAll('{email}', values.email ?? '')
    .replaceAll('{url}', values.url ?? '');
}
