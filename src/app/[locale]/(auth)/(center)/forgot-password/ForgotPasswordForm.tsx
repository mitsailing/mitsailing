'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authClient } from '@/libs/auth-client';

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

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
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
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-800" htmlFor="email">
          {t('email_label')}
        </label>
        <input
          autoComplete="email"
          className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 ring-blue-600 outline-none focus:ring-2"
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

      <button
        className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        disabled={submitting}
        type="submit"
      >
        {t('submit')}
      </button>
    </form>
  );
}
