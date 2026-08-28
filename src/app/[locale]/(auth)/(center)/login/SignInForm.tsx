'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { resolveSignInEmailAction } from '@/libs/auth/signInEmailActions';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

type SignInFormProps = {
  callbackUrl: string;
};

type ErrorState =
  | { kind: 'generic'; message: string }
  | { kind: 'unverified'; email: string }
  | null;
type MappedErrorState = Exclude<ErrorState, null>;
type SignInStep = 'email' | 'password';

type SignInKnownErrorMessages = {
  ACCOUNT_LOCKED: string;
  BANNED_USER: string;
  INVALID_EMAIL_OR_PASSWORD: string;
  TOO_MANY_REQUESTS: string;
};

function mappedSignInErrorMessage(
  code: string | undefined,
  messages: SignInKnownErrorMessages
): string | undefined {
  if (code === 'INVALID_EMAIL_OR_PASSWORD') {
    return messages.INVALID_EMAIL_OR_PASSWORD;
  }
  if (code === 'ACCOUNT_LOCKED') {
    return messages.ACCOUNT_LOCKED;
  }
  if (code === 'TOO_MANY_REQUESTS') {
    return messages.TOO_MANY_REQUESTS;
  }
  if (code === 'BANNED_USER') {
    return messages.BANNED_USER;
  }
  return undefined;
}

function reportUnmappedSignInAuthError(options: {
  action: string;
  code: string | undefined;
  message: string | undefined;
}) {
  if (!options.message && !options.code) {
    return;
  }
  reportUnknownAuthClientError(options);
}

// Email-first sign-in form. The email gate determines whether to show the
// password field, send a create-password reset code, or hand unknown emails to
// sign-up. Known Better Auth error codes still map to translated page copy so
// raw backend text never renders.
export function SignInForm(props: SignInFormProps) {
  const t = useTranslations('SignInPage');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [step, setStep] = useState<SignInStep>('email');
  const [error, setError] = useState<ErrorState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function mapError(options: {
    action: string;
    code: string | undefined;
    message: string | undefined;
    signInEmail?: string;
  }): MappedErrorState {
    if (options.code === 'EMAIL_NOT_VERIFIED') {
      return { kind: 'unverified', email: options.signInEmail ?? email };
    }
    const mappedMessage = mappedSignInErrorMessage(options.code, {
      INVALID_EMAIL_OR_PASSWORD: t('error_credentials'),
      ACCOUNT_LOCKED: t('error_locked'),
      TOO_MANY_REQUESTS: t('error_rate_limited'),
      BANNED_USER: t('error_banned'),
    });
    if (mappedMessage) {
      return { kind: 'generic', message: mappedMessage };
    }
    reportUnmappedSignInAuthError({
      action: options.action,
      code: options.code,
      message: options.message,
    });
    return { kind: 'generic', message: t('error_credentials') };
  }

  function mapGenericMessage(
    action: string,
    code: string | undefined,
    message: string | undefined
  ): string {
    const mapped = mapError({ action, code, message });
    if (mapped.kind === 'generic') {
      return mapped.message;
    }
    return t('error_credentials');
  }

  async function onEmailSubmit() {
    setError(null);
    setResent(false);
    const normalizedEmail = normalizeEmailAddress(email);
    setEmail(normalizedEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      setError({ kind: 'generic', message: t('error_invalid_email') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await resolveSignInEmailAction({ email: normalizedEmail });
      if (res.state === 'invalid_email') {
        setError({ kind: 'generic', message: t('error_invalid_email') });
        return;
      }
      setEmail(res.email);
      if (res.state === 'password') {
        setStep('password');
        return;
      }
      if (res.state === 'sign_up') {
        router.push(
          authHrefWithCallback(
            `/signup?email=${encodeURIComponent(res.email)}`,
            props.callbackUrl
          )
        );
        return;
      }
      if (res.state === 'reset_required') {
        router.push(
          authHrefWithCallback(
            `/reset-password?email=${encodeURIComponent(
              res.email
            )}&codeSent=1&mode=create-password`,
            props.callbackUrl
          )
        );
        return;
      }
      setError({ kind: 'generic', message: t('error_reset_failed') });
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'sign_in.email_lookup.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setError({ kind: 'generic', message: t('error_request_failed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function onPasswordSubmit() {
    setError(null);
    setResent(false);
    const normalizedEmail = normalizeEmailAddress(email);
    setEmail(normalizedEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      setError({ kind: 'generic', message: t('error_invalid_email') });
      setStep('email');
      return;
    }
    setSubmitting(true);
    const continuationHref = authHrefWithCallback(
      '/login/continue',
      props.callbackUrl
    );
    try {
      const res = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        callbackURL: continuationHref,
      });

      if (res.error) {
        setError(
          mapError({
            action: 'sign_in.email',
            code: res.error.code,
            message: res.error.message,
            signInEmail: normalizedEmail,
          })
        );
        return;
      }
      router.push(continuationHref);
      router.refresh();
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'sign_in.email.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setError({ kind: 'generic', message: t('error_request_failed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 'email') {
      await onEmailSubmit();
      return;
    }
    await onPasswordSubmit();
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
          message: mapGenericMessage(
            'sign_in.send_verification_otp',
            res.error.code,
            res.error.message
          ),
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
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'sign_in.send_verification_otp.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setError({ kind: 'generic', message: t('error_request_failed') });
    } finally {
      setResending(false);
    }
  }

  const normalizedForgotPasswordEmail = normalizeEmailAddress(email);
  const forgotPasswordPath = isValidEmailAddress(normalizedForgotPasswordEmail)
    ? `/forgot-password?email=${encodeURIComponent(normalizedForgotPasswordEmail)}`
    : '/forgot-password';
  const forgotPasswordHref = authHrefWithCallback(
    forgotPasswordPath,
    props.callbackUrl
  );

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
              onClick={() => {
                // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the resend promise.
                void onSendVerificationCode(error.email);
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

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onSubmit(event);
        }}
      >
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
              if (step === 'password') {
                setPassword('');
                setStep('email');
              }
            }}
            required
            type="email"
            value={email}
          />
        </div>

        {step === 'password' ? (
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
        ) : null}

        <SubmitButton
          className="w-full"
          pending={submitting}
          pendingLabel={tCommon('pending_submitting')}
          variant="mit"
        >
          {step === 'password' ? t('submit') : t('continue_submit')}
        </SubmitButton>
      </form>

      <p className="text-center text-sm text-mit-text">
        <a className={authInlineLinkClassName} href={forgotPasswordHref}>
          {t('forgot_password')}
        </a>
      </p>
    </>
  );
}
