'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
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
type MappedErrorState = Exclude<ErrorState, null>;

// Client-side sign-in form wired directly to `authClient.signIn.email`.
// Known Better Auth error codes are mapped to translated page copy; unknown
// codes use the generic credentials string so raw backend text never renders.
// The unverified path sends an email code and moves the user to the
// verification screen without losing their original callback.
export function SignInForm(props: SignInFormProps) {
  const t = useTranslations('SignInPage');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [requestingReset, setRequestingReset] = useState(false);
  const requestingResetRef = useRef(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function mapError(
    code: string | undefined,
    _message: string | undefined,
    signInEmail?: string
  ): MappedErrorState {
    if (code === 'EMAIL_NOT_VERIFIED') {
      return { kind: 'unverified', email: signInEmail ?? email };
    }
    const mapping: Record<string, string> = {
      INVALID_EMAIL_OR_PASSWORD: t('error_credentials'),
      ACCOUNT_LOCKED: t('error_locked'),
      TOO_MANY_REQUESTS: t('error_rate_limited'),
      BANNED_USER: t('error_banned'),
    };
    if (code && mapping[code]) {
      return { kind: 'generic', message: mapping[code] };
    }
    return { kind: 'generic', message: t('error_credentials') };
  }

  function mapGenericMessage(
    code: string | undefined,
    message: string | undefined
  ): string {
    const mapped = mapError(code, message);
    if (mapped.kind === 'generic') {
      return mapped.message;
    }
    return t('error_credentials');
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
    try {
      const res = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        callbackURL: props.callbackUrl,
      });

      if (res.error) {
        setError(mapError(res.error.code, res.error.message, normalizedEmail));
        return;
      }
      router.push(props.callbackUrl);
      router.refresh();
    } catch {
      setError({ kind: 'generic', message: t('error_request_failed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendVerificationCode(unverifiedEmail: string) {
    setResending(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: unverifiedEmail,
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
          `/verify-email?email=${encodeURIComponent(
            unverifiedEmail
          )}&codeSent=1`,
          props.callbackUrl
        )
      );
    } catch {
      setError({ kind: 'generic', message: t('error_request_failed') });
    } finally {
      setResending(false);
    }
  }

  async function onForgotPassword() {
    if (requestingResetRef.current) {
      return;
    }

    const normalizedEmail = normalizeMarketingEmail(email);
    if (!isValidMarketingEmail(normalizedEmail)) {
      setError({ kind: 'generic', message: t('error_invalid_email') });
      return;
    }

    setError(null);
    setResent(false);
    setEmail(normalizedEmail);
    requestingResetRef.current = true;
    setRequestingReset(true);
    try {
      const res = await authClient.emailOtp.requestPasswordReset({
        email: normalizedEmail,
      });

      if (res.error) {
        setError({ kind: 'generic', message: t('error_reset_failed') });
        return;
      }

      router.push(
        authHrefWithCallback(
          `/reset-password?email=${encodeURIComponent(
            normalizedEmail
          )}&codeSent=1`,
          props.callbackUrl
        )
      );
    } catch {
      setError({ kind: 'generic', message: t('error_reset_failed') });
    } finally {
      requestingResetRef.current = false;
      setRequestingReset(false);
    }
  }

  const normalizedForgotPasswordEmail = normalizeMarketingEmail(email);

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
              onClick={async () => {
                await onSendVerificationCode(error.email);
              }}
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

        <SubmitButton
          className="w-full"
          pending={submitting}
          pendingLabel={tCommon('pending_submitting')}
          variant="mit"
        >
          {t('submit')}
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-mit-text">
        {normalizedForgotPasswordEmail.length === 0 ? (
          <a
            className={authInlineLinkClassName}
            href={authHrefWithCallback('/forgot-password', props.callbackUrl)}
          >
            {t('forgot_password')}
          </a>
        ) : (
          <button
            className={`${authInlineLinkClassName} border-0 bg-transparent p-0 disabled:opacity-60`}
            disabled={requestingReset}
            onClick={onForgotPassword}
            type="button"
          >
            {t('forgot_password')}
          </button>
        )}
      </p>
    </>
  );
}
