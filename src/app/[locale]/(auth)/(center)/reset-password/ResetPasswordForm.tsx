'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { authClientThrownMessage } from '@/libs/auth/authClientThrownMessage';
import {
  authHrefWithCallback,
  safeAuthCallbackUrl,
} from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import { normalizeEmailAddress } from '@/utils/emailValidation';

type ResetPasswordFormProps = {
  callbackUrl: string;
  initialEmail: string;
  invalidToken: boolean;
  token: string;
};

export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('ResetPasswordPage');
  const router = useRouter();
  const safeCallbackUrl = safeAuthCallbackUrl(props.callbackUrl);
  const email = normalizeEmailAddress(props.initialEmail);
  const showPasswordForm = !props.invalidToken && Boolean(props.token);

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(
    showPasswordForm ? null : t('error_invalid_token')
  );
  const [submitting, setSubmitting] = useState(false);
  const [autoSignInFailed, setAutoSignInFailed] = useState(false);

  function mapError(options: {
    action: string;
    code: string | undefined;
    message: string | undefined;
  }): string {
    const lookupCode = options.code ?? options.message;
    if (lookupCode === 'PASSWORD_COMPROMISED') {
      return t('error_pwned');
    }
    if (lookupCode === 'PASSWORD_TOO_SHORT') {
      return t('error_password_too_short');
    }
    if (lookupCode === 'PASSWORD_TOO_LONG') {
      return t('error_password_too_long');
    }
    if (lookupCode === 'TOO_MANY_REQUESTS') {
      return t('error_rate_limited');
    }
    if (lookupCode === 'INVALID_TOKEN') {
      return t('error_invalid_token');
    }
    reportUnknownAuthClientError({
      action: options.action,
      code: options.code,
      message: options.message,
    });
    return t('error_validation');
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAutoSignInFailed(false);
    if (password !== passwordConfirmation) {
      setError(t('error_password_mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.resetPassword({
        newPassword: password,
        token: props.token,
      });
      if (res.error) {
        setError(
          mapError({
            action: 'reset-password.update-password',
            code: res.error.code,
            message: res.error.message,
          })
        );
        return;
      }
      const passwordForSignIn = password;
      setPassword('');
      setPasswordConfirmation('');
      if (!email) {
        setAutoSignInFailed(true);
        return;
      }
      try {
        const signInRes = await authClient.signIn.email({
          email,
          password: passwordForSignIn,
          callbackURL: safeCallbackUrl,
        });
        if (signInRes.error) {
          reportUnknownAuthClientError({
            code: signInRes.error.code,
            message: signInRes.error.message,
            action: 'reset-password.auto-sign-in',
          });
          setAutoSignInFailed(true);
          return;
        }
      } catch (signInError) {
        reportUnknownAuthClientError({
          action: 'reset-password.auto-sign-in',
          code: undefined,
          message:
            signInError instanceof Error ? signInError.message : undefined,
        });
        setAutoSignInFailed(true);
        return;
      }
      router.push(safeCallbackUrl);
      router.refresh();
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'reset-password.update-password.thrown',
        code: undefined,
        message: authClientThrownMessage(caughtError),
      });
      setError(t('error_request_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col items-center gap-8 text-center">
      {error ? (
        <p
          className="w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {showPasswordForm && !autoSignInFailed ? (
        <>
          <h1 className="text-center text-3xl font-normal tracking-normal text-foreground sm:text-4xl">
            {t('password_heading')}
          </h1>

          <form
            className="flex w-full flex-col gap-4"
            onSubmit={(event) => {
              // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the password form promise.
              void onSubmit(event);
            }}
          >
            <div className="flex flex-col gap-1.5 text-left">
              <Label className="text-foreground" htmlFor="password">
                {t('password_label')}
              </Label>
              <Input
                autoComplete="new-password"
                className="h-12 rounded-2xl px-5 text-base md:text-base"
                id="password"
                maxLength={128}
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

            <div className="flex flex-col gap-1.5 text-left">
              <Label className="text-foreground" htmlFor="passwordConfirmation">
                {t('password_confirmation_label')}
              </Label>
              <Input
                autoComplete="new-password"
                className="h-12 rounded-2xl px-5 text-base md:text-base"
                id="passwordConfirmation"
                maxLength={128}
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

            <SubmitButton
              className="h-12 w-full rounded-full"
              pending={submitting}
              pendingLabel={tCommon('pending_submitting')}
              variant="mit"
            >
              {t('submit')}
            </SubmitButton>
          </form>
        </>
      ) : null}

      {autoSignInFailed || !showPasswordForm ? (
        <p className="text-center text-sm text-mit-text">
          {autoSignInFailed ? `${t('auto_sign_in_failed')} ` : null}
          <I18nLink
            className={authInlineLinkClassName}
            href={authHrefWithCallback('/login', props.callbackUrl)}
          >
            {t('back_sign_in')}
          </I18nLink>
        </p>
      ) : null}
    </section>
  );
}
