'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authInputClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';

type ResetPasswordFormProps = {
  token: string;
  signInUrl: string;
};

// Client-side reset-password form. Posts the new password with the token
// that Better Auth embedded in the reset link (`?token=...`).
export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const t = useTranslations('ResetPasswordPage');
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function mapError(
    code: string | undefined,
    message: string | undefined
  ): string {
    if (code === 'PASSWORD_COMPROMISED') {
      return t('error_pwned');
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return t('error_rate_limited');
    }
    return message ?? t('error_validation');
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError(t('error_password_mismatch'));
      return;
    }
    if (!props.token) {
      setError(t('error_validation'));
      return;
    }
    setSubmitting(true);
    const res = await authClient.resetPassword({
      newPassword: password,
      token: props.token,
    });
    setSubmitting(false);
    if (res.error) {
      setError(mapError(res.error.code, res.error.message));
      return;
    }
    router.push(`${props.signInUrl}?reset=1`);
  }

  return (
    <>
      {error ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-mit-text"
            htmlFor="password"
          >
            {t('password_label')}
          </label>
          <input
            autoComplete="new-password"
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
          <span className="text-xs text-mit-text/80">{t('password_hint')}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-mit-text"
            htmlFor="passwordConfirmation"
          >
            {t('password_confirmation_label')}
          </label>
          <input
            autoComplete="new-password"
            className={authInputClassName}
            id="passwordConfirmation"
            minLength={8}
            name="passwordConfirmation"
            onChange={(e) => {
              setPasswordConfirmation(e.target.value);
            }}
            required
            type="password"
            value={passwordConfirmation}
          />
        </div>

        <Button className="w-full" disabled={submitting} type="submit">
          {t('submit')}
        </Button>
      </form>
    </>
  );
}
