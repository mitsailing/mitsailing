'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { authClientThrownMessage } from '@/libs/auth/authClientThrownMessage';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

type CheckEmailNoticeProps = {
  callbackUrl: string;
  email: string;
};

/**
 * Post-signup verification screen. Sign-up redirects here after Better Auth
 * sends the first verification email. Resend uses
 * `authClient.sendVerificationEmail`; `callbackURL` is the destination after
 * the sailor clicks the link, not this page.
 *
 * @param props - Notice props with callback URL and optional email query value.
 * @returns Check-email instructions, resend control, or signup fallback.
 */
export function CheckEmailNotice(props: CheckEmailNoticeProps) {
  const t = useTranslations('CheckEmailPage');
  const normalizedEmail = normalizeEmailAddress(props.email);
  const hasEmail = isValidEmailAddress(normalizedEmail);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onResend() {
    setResending(true);
    setErrorMessage(null);
    setResent(false);
    try {
      const res = await authClient.sendVerificationEmail({
        email: normalizedEmail,
        callbackURL: props.callbackUrl,
      });
      if (res.error) {
        const lookupCode = res.error.code ?? res.error.message;
        if (lookupCode === 'TOO_MANY_REQUESTS') {
          setErrorMessage(t('error_rate_limited'));
          return;
        }
        reportUnknownAuthClientError({
          action: 'check_email.send_verification_email',
          code: res.error.code,
          message: res.error.message,
        });
        setErrorMessage(t('error_request_failed'));
        return;
      }
      setResent(true);
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'check_email.send_verification_email.thrown',
        code: undefined,
        message: authClientThrownMessage(caughtError),
      });
      setErrorMessage(t('error_request_failed'));
    } finally {
      setResending(false);
    }
  }

  if (!hasEmail) {
    // Avoid re-wrapping an already-nested onboarding callbackUrl through SignUpPage.
    const signupHref = props.callbackUrl.startsWith('/onboarding')
      ? '/signup'
      : authHrefWithCallback('/signup', props.callbackUrl);

    return (
      <div className="space-y-4 text-center text-sm text-mit-text">
        <p>{t('missing_email_body')}</p>
        <p>
          <I18nLink className={authInlineLinkClassName} href={signupHref}>
            {t('back_sign_up')}
          </I18nLink>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p
        aria-live="polite"
        className="rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-medium text-green-900 dark:bg-green-950/30 dark:text-green-100"
        role="status"
      >
        {t('sent_status', { email: normalizedEmail })}
      </p>
      <p className="text-center text-sm text-mit-text">
        {t('spam_instruction')}
      </p>
      {errorMessage ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-red-900 dark:text-red-100"
          role="alert"
        >
          {errorMessage}
        </p>
      ) : null}
      {resent ? (
        <p
          aria-live="polite"
          className="rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-medium text-green-900 dark:bg-green-950/30 dark:text-green-100"
          role="status"
        >
          {t('resent_banner')}
        </p>
      ) : null}
      <div className="flex justify-center">
        <Button
          className="h-auto min-h-11 px-0 py-0 text-base font-medium text-foreground underline shadow-none hover:bg-transparent hover:text-foreground/80 hover:underline disabled:opacity-60"
          disabled={resending}
          onClick={() => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the resend promise.
            void onResend();
          }}
          type="button"
          variant="link"
        >
          {t('resend_email')}
        </Button>
      </div>
    </div>
  );
}
