'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  authInputClassName,
  authPrimaryButtonClassName,
} from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type ForgotPasswordFormProps = {
  resetRedirectUrl: string;
};

// Client-side password-reset request form. Always renders the same "sent"
// banner on 2xx so the endpoint stays non-enumerating even though the
// sign-up flow exposes existence explicitly elsewhere.
export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const t = useTranslations('ForgotPasswordPage');
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    if (!isValidMarketingEmail(email)) {
      setEmailError(t('error_invalid_email'));
      return;
    }
    setSubmitting(true);
    await authClient.requestPasswordReset({
      email,
      redirectTo: props.resetRedirectUrl,
    });
    setSubmitting(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {t('sent_banner')}
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {emailError ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {emailError}
        </p>
      ) : null}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-mit-text" htmlFor="email">
          {t('email_label')}
        </label>
        <input
          autoComplete="email"
          className={authInputClassName}
          id="email"
          inputMode="email"
          name="email"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          required
          type="email"
          value={email}
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
  );
}
