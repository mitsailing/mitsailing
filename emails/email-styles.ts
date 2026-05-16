import * as React from 'react';
import { Link } from 'react-email';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

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

/**
 * Verifies transactional auth emails only render six-digit OTP codes.
 *
 * @param code - OTP code to render in an email template.
 * @param templateName - Template name used in the error message.
 * @throws When the code is not exactly six digits.
 */
export function assertSixDigitCode(code: string, templateName: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new Error(`${templateName} requires a six-digit code.`);
  }
}

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

/**
 * Replaces auth email placeholders in localized copy.
 *
 * @param message - Template string containing `{code}` or `{email}` tokens.
 * @param values - Optional replacement values for the supported tokens.
 * @returns The message with supported placeholders replaced.
 */
export function replaceAuthEmailValues(
  message: string,
  values: { code?: string; email?: string; url?: string }
): string {
  return message
    .replaceAll('{code}', values.code ?? '')
    .replaceAll('{email}', values.email ?? '')
    .replaceAll('{url}', values.url ?? '');
}

/**
 * Renders a localized support message with a mailto link when markup is valid.
 *
 * @param props - Support message details.
 * @param props.message - Message template with an optional support tag pair.
 * @param props.supportEmail - Support mailbox used for link and placeholders.
 * @returns Plain text or a React node containing the support mailto link.
 */
export function supportMessage(props: {
  message: string;
  supportEmail: string;
}): React.ReactNode {
  const openTag = '<support>';
  const closeTag = '</support>';
  const openIndex = props.message.indexOf(openTag);
  const closeIndex = props.message.indexOf(closeTag);
  const hasSingleSupportPair =
    openIndex !== -1 &&
    closeIndex !== -1 &&
    openIndex < closeIndex &&
    openIndex === props.message.lastIndexOf(openTag) &&
    closeIndex === props.message.lastIndexOf(closeTag);

  if (!hasSingleSupportPair) {
    return replaceAuthEmailValues(props.message, { email: props.supportEmail });
  }

  const normalizedSupportEmail = normalizeEmailAddress(props.supportEmail);
  const beforeSupport = props.message.slice(0, openIndex);
  const supportText = props.message.slice(
    openIndex + openTag.length,
    closeIndex
  );
  const afterSupport = props.message.slice(closeIndex + closeTag.length);

  if (!isValidEmailAddress(normalizedSupportEmail)) {
    return replaceAuthEmailValues(
      `${beforeSupport}${supportText}${afterSupport}`,
      { email: normalizedSupportEmail }
    );
  }

  return React.createElement(
    React.Fragment,
    null,
    replaceAuthEmailValues(beforeSupport, { email: normalizedSupportEmail }),
    React.createElement(
      Link,
      { href: `mailto:${normalizedSupportEmail}`, style: supportLink },
      replaceAuthEmailValues(supportText, { email: normalizedSupportEmail })
    ),
    replaceAuthEmailValues(afterSupport, { email: normalizedSupportEmail })
  );
}
