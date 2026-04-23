'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { authClient } from '@/libs/auth-client';
import { Link as I18nLink } from '@/libs/I18nNavigation';

type ErrorState = {
  message: string;
  showSignInLinks: boolean;
} | null;

type SignUpFormProps = {
  verifyCallbackUrl: string;
};

// Client-side sign-up form. Calls `authClient.signUp.email` and maps the
// explicit `EMAIL_EXISTS` and `PASSWORD_COMPROMISED` codes (both surfaced by
// our hooks + HaveIBeenPwned plugin) to copy that keeps the Devise-style UX.
export function SignUpForm(props: SignUpFormProps) {
  const t = useTranslations('SignUpPage');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<ErrorState>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function mapError(
    code: string | undefined,
    message: string | undefined
  ): ErrorState {
    if (code === 'EMAIL_EXISTS') {
      return { message: t('error_exists'), showSignInLinks: true };
    }
    if (code === 'PASSWORD_COMPROMISED') {
      return { message: t('error_pwned'), showSignInLinks: false };
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return { message: t('error_rate_limited'), showSignInLinks: false };
    }
    return {
      message: message ?? t('error_generic'),
      showSignInLinks: false,
    };
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (password !== passwordConfirmation) {
      setError({
        message: t('error_password_mismatch'),
        showSignInLinks: false,
      });
      return;
    }
    setSubmitting(true);
    const res = await authClient.signUp.email({
      email,
      password,
      name: name.trim() === '' ? (email.split('@')[0] ?? '') : name,
      callbackURL: props.verifyCallbackUrl,
    });
    setSubmitting(false);
    if (res.error) {
      setError(mapError(res.error.code, res.error.message));
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {t('registered_banner')}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error.message}
          {error.showSignInLinks ? (
            <>
              {' '}
              <I18nLink className="underline" href="/sign-in">
                {t('sign_in_link')}
              </I18nLink>
              {' · '}
              <I18nLink className="underline" href="/forgot-password">
                {t('forgot_password_link')}
              </I18nLink>
            </>
          ) : null}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-800" htmlFor="name">
            {t('name_label')}
          </label>
          <input
            autoComplete="name"
            className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 ring-blue-600 outline-none focus:ring-2"
            id="name"
            name="name"
            onChange={(e) => {
              setName(e.target.value);
            }}
            type="text"
            value={name}
          />
        </div>

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

        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-gray-800"
            htmlFor="password"
          >
            {t('password_label')}
          </label>
          <input
            autoComplete="new-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 ring-blue-600 outline-none focus:ring-2"
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
          <span className="text-xs text-gray-500">{t('password_hint')}</span>
        </div>

        <div className="flex flex-col gap-1">
          <label
            className="text-sm font-medium text-gray-800"
            htmlFor="passwordConfirmation"
          >
            {t('password_confirmation_label')}
          </label>
          <input
            autoComplete="new-password"
            className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 ring-blue-600 outline-none focus:ring-2"
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

        <button
          className="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          disabled={submitting}
          type="submit"
        >
          {t('submit')}
        </button>
      </form>
    </>
  );
}
