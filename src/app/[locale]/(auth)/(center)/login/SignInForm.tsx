'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  authInputClassName,
  authPrimaryButtonClassName,
} from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type SignInFormProps = {
  callbackUrl: string;
  verifyCallbackUrl: string;
};

type ErrorState =
  | { kind: 'generic'; message: string }
  | { kind: 'unverified'; email: string }
  | null;

// Client-side sign-in form wired directly to `authClient.signIn.email`.
// Known Better Auth error codes are mapped to translated page copy; anything
// else falls back to `error.message` (already translated by the i18n plugin).
// The unverified path surfaces a resend button + support mailto so users
// have a path forward without bouncing between pages.
export function SignInForm(props: SignInFormProps) {
  const t = useTranslations('SignInPage');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [submitting, setSubmitting] = useState(false);
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

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResent(false);
    if (!isValidMarketingEmail(email)) {
      setError({ kind: 'generic', message: t('error_invalid_email') });
      return;
    }
    setSubmitting(true);

    const res = await authClient.signIn.email({
      email,
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

  async function onResendVerification() {
    if (error?.kind !== 'unverified' || error.email.trim() === '') {
      return;
    }
    setResending(true);
    await authClient.sendVerificationEmail({
      email: error.email,
      callbackURL: props.verifyCallbackUrl,
    });
    setResending(false);
    setResent(true);
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
            <button
              className="font-medium text-red-900 underline disabled:opacity-60"
              disabled={resending}
              onClick={onResendVerification}
              type="button"
            >
              {t('error_unverified_resend_link')}
            </button>
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
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-mit-text" htmlFor="email">
            {t('email_label')}
          </label>
          <input
            autoComplete="email"
            className={authInputClassName}
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

        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-mit-text"
            htmlFor="password"
          >
            {t('password_label')}
          </label>
          <input
            autoComplete="current-password"
            className={authInputClassName}
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

        <button
          className={authPrimaryButtonClassName}
          disabled={submitting}
          type="submit"
        >
          {t('submit')}
        </button>
      </form>
    </>
  );
}
