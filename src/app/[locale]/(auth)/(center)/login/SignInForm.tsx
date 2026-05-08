'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import {
  isValidMarketingEmail,
  normalizeMarketingEmail,
} from '@/utils/emailValidation';

type SignInFormProps = {
  callbackUrl: string;
};

type ErrorState =
  | { kind: 'generic'; message: string }
  | { kind: 'unverified'; email: string }
  | null;

// Client-side sign-in form wired directly to `authClient.signIn.email`.
// Known Better Auth error codes are mapped to translated page copy; anything
// else falls back to `error.message` (already translated by the i18n plugin).
// The unverified path sends an email code and moves the user to the
// verification screen without losing their original callback.
export function SignInForm(props: SignInFormProps) {
  const t = useTranslations('SignInPage');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function mapError(
    code: string | undefined,
    message: string | undefined
  ): ErrorState {
    if (code === 'EMAIL_NOT_VERIFIED') {
      return { kind: 'unverified', email };
    }
    const mapping: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD: t('error_credentials'),
      ACCOUNT_LOCKED: t('error_locked'),
      TOO_MANY_REQUESTS: t('error_rate_limited'),
    };
    if (code && mapping[code]) {
      return { kind: 'generic', message: mapping[code] };
    }
    return { kind: 'generic', message: message ?? t('error_credentials') };
  }

  function mapGenericMessage(
    code: string | undefined,
    message: string | undefined
  ): string {
    const mapped = mapError(code, message);
    if (mapped?.kind === 'generic') {
      return mapped.message;
    }
    return message ?? t('error_credentials');
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResent(false);
    const normalizedEmail = normalizeMarketingEmail(email);
    setEmail(normalizedEmail);
    if (!isValidMarketingEmail(normalizedEmail)) {
      setError({ kind: 'generic', message: t('error_invalid_email') });
      return;
    }
    setSubmitting(true);

    const res = await authClient.signIn.email({
      email: normalizedEmail,
      password,
      callbackURL: props.callbackUrl,
    });

    setSubmitting(false);
    if (res.error) {
      setError(mapError(res.error.code, res.error.message));
      return;
    }
    router.push(props.callbackUrl);
    router.refresh();
  }

  async function onSendVerificationCode() {
    if (error?.kind !== 'unverified' || error.email.trim() === '') {
      return;
    }
    setResending(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: error.email,
        type: 'email-verification',
      });
      if (res.error) {
        setError({
          kind: 'generic',
          message: mapGenericMessage(res.error.code, res.error.message),
        });
        return;
      }
      setResent(true);
      router.push(
        authHrefWithCallback(
          `/verify-email?email=${encodeURIComponent(error.email)}`,
          props.callbackUrl
        )
      );
    } catch {
      setError({ kind: 'generic', message: t('error_rate_limited') });
    } finally {
      setResending(false);
    }
  }

  async function onForgotPassword(event: React.MouseEvent<HTMLAnchorElement>) {
    const normalizedEmail = normalizeMarketingEmail(email);
    if (!isValidMarketingEmail(normalizedEmail)) {
      return;
    }

    event.preventDefault();
    if (requestingReset) {
      return;
    }

    setError(null);
    setResent(false);
    setEmail(normalizedEmail);
    setRequestingReset(true);
    try {
      const res = await authClient.emailOtp.requestPasswordReset({
        email: normalizedEmail,
      });
      if (res.error) {
        setError({ kind: 'generic', message: t('error_reset_failed') });
        setRequestingReset(false);
        return;
      }

      router.push(
        authHrefWithCallback(
          `/reset-password?email=${encodeURIComponent(normalizedEmail)}`,
          props.callbackUrl
        )
      );
    } catch {
      setError({ kind: 'generic', message: t('error_reset_failed') });
      setRequestingReset(false);
    }
  }

  return (
    <>
      {error?.kind === 'generic' ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error.message}
        </p>
      ) : null}

      {error?.kind === 'unverified' ? (
        <div
          className="space-y-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          <p>{t('error_unverified')}</p>
          {resent ? (
            <p className="text-red-900">{t('error_unverified_resent')}</p>
          ) : (
            <Button
              className="h-auto min-h-0 px-0 py-0 font-medium text-red-900 underline shadow-none hover:bg-transparent hover:text-red-950 hover:underline disabled:opacity-60"
              disabled={resending}
              onClick={onSendVerificationCode}
              type="button"
              variant="link"
            >
              {t('error_unverified_resend_link')}
            </Button>
          )}
          <p>
            {t.rich('error_unverified_support', {
              support: (chunks) => (
                <a className="underline" href="mailto:support@mitsailing.com">
                  {chunks}
                </a>
              ),
            })}
          </p>
        </div>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="email">
            {t('email_label')}
          </Label>
          <Input
            autoComplete="email"
            id="email"
            name="email"
            onChange={(e) => {
              setEmail(e.target.value);
            }}
            required
            type="email"
            value={email}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="password">
            {t('password_label')}
          </Label>
          <Input
            autoComplete="current-password"
            id="password"
            minLength={8}
            name="password"
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            required
            type="password"
            value={password}
          />
        </div>

        <Button
          className="w-full"
          disabled={submitting}
          type="submit"
          variant="mit"
        >
          {t('submit')}
        </Button>
      </form>

      <p className="text-center text-sm text-mit-text">
        <a
          aria-disabled={requestingReset}
          className={authInlineLinkClassName}
          href={authHrefWithCallback(
            isValidMarketingEmail(email)
              ? `/forgot-password?email=${encodeURIComponent(
                  normalizeMarketingEmail(email)
                )}`
              : '/forgot-password',
            props.callbackUrl
          )}
          onClick={onForgotPassword}
        >
          {t('forgot_password')}
        </a>
      </p>
    </>
  );
}
