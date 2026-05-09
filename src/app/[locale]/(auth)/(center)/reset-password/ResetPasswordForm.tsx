'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/libs/auth-client';
import {
  isValidMarketingEmail,
  normalizeMarketingEmail,
} from '@/utils/emailValidation';

type ResetPasswordFormProps = {
  callbackUrl: string;
  initialEmail: string;
  initialResendLocked?: boolean;
  passwordHeading: string;
};

export function ResetPasswordForm(props: ResetPasswordFormProps) {
  const t = useTranslations('ResetPasswordPage');
  const router = useRouter();
  const normalizedInitialEmail = normalizeMarketingEmail(props.initialEmail);
  const hasInitialEmail = isValidMarketingEmail(normalizedInitialEmail);
  const [email, setEmail] = useState(normalizedInitialEmail);
  const [resetCode, setResetCode] = useState('');
  const [step, setStep] = useState<'code' | 'password'>('code');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendLocked, setResendLocked] = useState(
    props.initialResendLocked ?? false
  );
  const resendTimeoutRef = useRef<number | null>(null);

  function mapError(options: {
    code: string | undefined;
    message?: string;
    passwordStep?: boolean;
  }): string {
    if (options.code === 'PASSWORD_TOO_SHORT') {
      return t('error_password_too_short');
    }
    if (options.code === 'PASSWORD_TOO_LONG') {
      return t('error_password_too_long');
    }
    if (options.code === 'PASSWORD_COMPROMISED') {
      return t('error_pwned');
    }
    if (options.code === 'OTP_EXPIRED') {
      return options.passwordStep
        ? t('error_expired_password_step')
        : t('error_expired');
    }
    if (options.code === 'INVALID_OTP') {
      return t('error_invalid_code');
    }
    if (options.code === 'TOO_MANY_ATTEMPTS') {
      return t('error_too_many_attempts');
    }
    if (options.code === 'TOO_MANY_REQUESTS') {
      return t('error_rate_limited');
    }
    return options.message ?? t('error_validation');
  }

  function lockResend() {
    if (resendTimeoutRef.current !== null) {
      clearTimeout(resendTimeoutRef.current);
      resendTimeoutRef.current = null;
    }
    setResendLocked(true);
    resendTimeoutRef.current = window.setTimeout(() => {
      setResendLocked(false);
      resendTimeoutRef.current = null;
    }, 30_000);
  }

  useEffect(() => {
    if (props.initialResendLocked) {
      lockResend();
    }

    return () => {
      if (resendTimeoutRef.current !== null) {
        clearTimeout(resendTimeoutRef.current);
        resendTimeoutRef.current = null;
      }
    };
  }, [props.initialResendLocked]);

  async function onCodeSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    const normalizedEmail = normalizeMarketingEmail(email);
    setEmail(normalizedEmail);
    if (!isValidMarketingEmail(normalizedEmail)) {
      setError(t('error_invalid_email'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.emailOtp.checkVerificationOtp({
        email: normalizedEmail,
        otp: resetCode,
        type: 'forget-password',
      });
      if (res.error) {
        setError(
          mapError({ code: res.error.code, message: res.error.message })
        );
        return;
      }
    } catch {
      setError(t('error_request_failed'));
      return;
    } finally {
      setSubmitting(false);
    }
    setStep('password');
  }

  async function onResendCode() {
    setError(null);
    setStatus(null);
    const normalizedEmail = normalizeMarketingEmail(email);
    setEmail(normalizedEmail);
    if (!isValidMarketingEmail(normalizedEmail)) {
      setError(t('error_invalid_email'));
      return;
    }
    setResending(true);
    try {
      const res = await authClient.emailOtp.requestPasswordReset({
        email: normalizedEmail,
      });
      if (res.error) {
        setError(
          mapError({ code: res.error.code, message: res.error.message })
        );
        return;
      }
      setStatus(t('resent_banner'));
      lockResend();
    } catch {
      setError(t('error_resend_failed'));
    } finally {
      setResending(false);
    }
  }

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setStatus(null);
    const normalizedEmail = normalizeMarketingEmail(email);
    setEmail(normalizedEmail);
    if (password !== passwordConfirmation) {
      setError(t('error_password_mismatch'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.emailOtp.resetPassword({
        email: normalizedEmail,
        otp: resetCode,
        password,
      });
      if (res.error) {
        if (
          res.error.code === 'INVALID_OTP' ||
          res.error.code === 'OTP_EXPIRED' ||
          res.error.code === 'TOO_MANY_ATTEMPTS'
        ) {
          if (res.error.code === 'OTP_EXPIRED') {
            setResetCode('');
          }
          setStep('code');
        }
        setError(
          mapError({
            code: res.error.code,
            message: res.error.message,
            passwordStep: true,
          })
        );
        return;
      }
      const signInRes = await authClient.signIn.email({
        email: normalizedEmail,
        password,
        callbackURL: props.callbackUrl,
      });
      if (signInRes.error) {
        setError(
          mapError({
            code: signInRes.error.code,
            message: signInRes.error.message,
          })
        );
        return;
      }
      router.push(props.callbackUrl);
      router.refresh();
    } catch {
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

      {status ? (
        <p
          className="w-full rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800"
          role="status"
        >
          {status}
        </p>
      ) : null}

      {step === 'code' ? (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center text-4xl font-normal tracking-normal text-foreground sm:text-5xl">
            {t('heading')}
          </h1>
          <p className="max-w-md text-xl leading-relaxed text-pretty text-muted-foreground">
            {hasInitialEmail
              ? t('pending_body', { email })
              : t('pending_body_fallback')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-center text-3xl font-normal tracking-normal text-foreground sm:text-4xl">
            {props.passwordHeading}
          </h1>
        </div>
      )}

      {step === 'code' ? (
        <>
          <form className="flex w-full flex-col gap-6" onSubmit={onCodeSubmit}>
            {hasInitialEmail ? null : (
              <div>
                <Label className="sr-only" htmlFor="email">
                  {t('email_label')}
                </Label>
                <Input
                  autoComplete="email"
                  className="h-14 rounded-full px-8 text-xl md:text-xl"
                  id="email"
                  inputMode="email"
                  name="email"
                  onChange={(e) => {
                    setEmail(e.target.value);
                  }}
                  placeholder={t('email_placeholder')}
                  required
                  type="email"
                  value={email}
                />
              </div>
            )}

            <div>
              <Label className="sr-only" htmlFor="code">
                {t('code_label')}
              </Label>
              <Input
                autoComplete="one-time-code"
                className="h-14 rounded-full px-8 text-xl md:text-xl"
                enterKeyHint="done"
                id="code"
                inputMode="numeric"
                maxLength={6}
                minLength={6}
                name="code"
                onChange={(e) => {
                  setResetCode(
                    e.target.value.replaceAll(/\D/g, '').slice(0, 6)
                  );
                }}
                pattern="[0-9]{6}"
                placeholder={t('code_placeholder')}
                required
                type="text"
                value={resetCode}
              />
            </div>

            <Button
              className="h-14 w-full rounded-full bg-foreground text-lg font-normal text-background hover:bg-foreground/90"
              disabled={submitting || resetCode.length !== 6}
              type="submit"
            >
              {t('continue')}
            </Button>
          </form>

          <Button
            className="h-auto min-h-0 px-0 py-0 text-lg font-normal text-foreground no-underline shadow-none hover:bg-transparent hover:text-foreground/70 hover:no-underline disabled:opacity-60"
            disabled={resending || resendLocked}
            onClick={onResendCode}
            type="button"
            variant="link"
          >
            {resendLocked ? t('resend_wait') : t('resend_email')}
          </Button>
        </>
      ) : (
        <form className="flex w-full flex-col gap-4" onSubmit={onSubmit}>
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

          <Button
            className="h-12 w-full rounded-full"
            disabled={submitting}
            type="submit"
            variant="mit"
          >
            {t('submit')}
          </Button>
        </form>
      )}
    </section>
  );
}
