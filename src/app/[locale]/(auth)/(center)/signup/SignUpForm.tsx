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
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type ErrorState = {
  message: string;
  showSignInLinks: boolean;
} | null;

type SignUpFormProps = {
  callbackUrl: string;
};

// Client-side sign-up form. Calls `authClient.signUp.email` and maps the
// explicit `EMAIL_EXISTS` and `PASSWORD_COMPROMISED` codes (both surfaced by
// our hooks + HaveIBeenPwned plugin) to copy that keeps the Devise-style UX.
export function SignUpForm(props: SignUpFormProps) {
  const t = useTranslations('SignUpPage');
  const router = useRouter();
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
    // Better Auth may surface a code, a message, or both; hooks sometimes send
    // a semantic string in `message` when `code` is absent.
    if (code === 'EMAIL_EXISTS' || message === 'EMAIL_EXISTS') {
      return { message: t('error_exists'), showSignInLinks: true };
    }
    if (code === 'PASSWORD_COMPROMISED' || message === 'PASSWORD_COMPROMISED') {
      return { message: t('error_pwned'), showSignInLinks: false };
    }
    if (code === 'TOO_MANY_REQUESTS' || message === 'TOO_MANY_REQUESTS') {
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
    if (!isValidMarketingEmail(email)) {
      setError({
        message: t('error_invalid_email'),
        showSignInLinks: false,
      });
      return;
    }
    setSubmitting(true);
    const res = await authClient.signUp.email({
      email,
      password,
      name: name.trim() === '' ? (email.split('@')[0] ?? '') : name,
      callbackURL: props.callbackUrl,
    });
    setSubmitting(false);
    if (res.error) {
      setError(mapError(res.error.code, res.error.message));
      return;
    }
    setSubmitted(true);
    router.push(
      authHrefWithCallback(
        `/verify-email?email=${encodeURIComponent(email)}`,
        props.callbackUrl
      )
    );
  }

  return (
    <>
      {submitted ? (
        <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
          {t('registered_banner')}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {error.message}
          {error.showSignInLinks ? (
            <>
              {' '}
              <I18nLink
                className={authInlineLinkClassName}
                href={authHrefWithCallback('/login', props.callbackUrl)}
              >
                {t('sign_in_link')}
              </I18nLink>
              {' · '}
              <I18nLink
                className={authInlineLinkClassName}
                href={authHrefWithCallback(
                  '/forgot-password',
                  props.callbackUrl
                )}
              >
                {t('forgot_password_link')}
              </I18nLink>
            </>
          ) : null}
        </p>
      ) : null}

      <form className="flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="name">
            {t('name_label')}
          </Label>
          <Input
            autoComplete="name"
            id="name"
            name="name"
            onChange={(e) => {
              setName(e.target.value);
            }}
            type="text"
            value={name}
          />
        </div>

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
            autoComplete="new-password"
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
          <span className="text-xs text-muted-foreground">
            {t('password_hint')}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="passwordConfirmation">
            {t('password_confirmation_label')}
          </Label>
          <Input
            autoComplete="new-password"
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

        <Button
          className="w-full"
          disabled={submitting}
          type="submit"
          variant="mit"
        >
          {t('submit')}
        </Button>
      </form>
    </>
  );
}
