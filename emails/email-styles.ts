import type * as React from 'react';

/**
 * Shared inline styles for OTP / verification-family transactional emails
 * (`verify-email`, `password-reset`, `sign-in-otp`, `confirm-email-change`).
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

export const codeBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '6px',
  margin: '24px 0',
  padding: '16px 20px',
  textAlign: 'center' as const,
};

/** Muted line below the code (expiry text, support instructions). */
export const supportFooter: React.CSSProperties = {
  color: '#334155',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '16px 0 0',
};

export const supportLink: React.CSSProperties = {
  color: '#2563eb',
};
