'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/libs/auth-client';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type VerifyEmailFormProps = {
  callbackUrl: string;
  initialEmail: string;
};

type BannerState = {
  kind: 'error' | 'success';
  message: string;
} | null;

export function VerifyEmailForm(props: VerifyEmailFormProps) {
  const t = useTranslations('VerifyEmailPage');
  const router = useRouter();
  const hasInitialEmail = isValidMarketingEmail(props.initialEmail);
  const [email, setEmail] = useState(props.initialEmail);
  const [code, setCode] = useState('');
  const [banner, setBanner] = useState<BannerState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const resendTimeoutRef = useRef<number | null>(null);

  function mapError(
    codeValue: string | undefined,
    message: string | undefined
  ): string {
    if (codeValue === 'OTP_EXPIRED') {
      return t('error_expired');
    }
    if (codeValue === 'INVALID_OTP') {
      return t('error_invalid_code');
    }
    if (codeValue === 'TOO_MANY_ATTEMPTS') {
      return t('error_too_many_attempts');
    }
    if (codeValue === 'TOO_MANY_REQUESTS') {
      return t('error_rate_limited');
    }
    return message ?? t('error_invalid_code');
  }

  function lockResend() {
    if (resendTimeoutRef.current) {
      clearTimeout(resendTimeoutRef.current);
    }
    setResendLocked(true);
    resendTimeoutRef.current = window.setTimeout(() => {
      setResendLocked(false);
      resendTimeoutRef.current = null;
    }, 30_000);
  }

  useEffect(
    () => () => {
      if (resendTimeoutRef.current) {
        clearTimeout(resendTimeoutRef.current);
        resendTimeoutRef.current = null;
      }
    },
    []
  );

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    if (!isValidMarketingEmail(email)) {
      setBanner({ kind: 'error', message: t('error_invalid_email') });
      return;
    }
    setSubmitting(true);
    const res = await authClient.emailOtp.verifyEmail({
      email,
      otp: code,
    });
    setSubmitting(false);
    if (res.error) {
      setBanner({
        kind: 'error',
        message: mapError(res.error.code, res.error.message),
      });
      return;
    }
    router.push(props.callbackUrl);
    router.refresh();
  }

  async function onResendCode() {
    setBanner(null);
    if (!isValidMarketingEmail(email)) {
      setBanner({ kind: 'error', message: t('error_invalid_email') });
      return;
    }
    setResending(true);
    const res = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'email-verification',
    });
    setResending(false);
    if (res.error) {
      setBanner({
        kind: 'error',
        message: mapError(res.error.code, res.error.message),
      });
      return;
    }
    setBanner({ kind: 'success', message: t('resent_banner') });
    lockResend();
  }

  return (
    <section className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center text-4xl font-normal tracking-normal text-foreground sm:text-5xl">
          {t('heading')}
        </h1>
        <p className="max-w-md text-xl leading-relaxed text-pretty text-muted-foreground">
          {hasInitialEmail
            ? t('pending_body', { email: props.initialEmail })
            : t('pending_body_fallback')}
        </p>
      </div>

      {banner ? (
        <p
          className={
            banner.kind === 'error'
              ? 'w-full rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800'
              : 'w-full rounded-2xl bg-green-50 px-4 py-3 text-sm text-green-800'
          }
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.message}
        </p>
      ) : null}

      <form className="flex w-full flex-col gap-6" onSubmit={onSubmit}>
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
              setCode(e.target.value.replaceAll(/\D/g, '').slice(0, 6));
            }}
            pattern="[0-9]{6}"
            placeholder={t('code_placeholder')}
            required
            type="text"
            value={code}
          />
        </div>

        <Button
          className="h-14 w-full rounded-full bg-foreground text-lg font-normal text-background hover:bg-foreground/90"
          disabled={submitting || code.length !== 6}
          type="submit"
        >
          {t('submit')}
        </Button>
      </form>

      <Button
        className="h-auto min-h-0 px-0 py-0 text-lg font-normal text-foreground no-underline shadow-none hover:bg-transparent hover:text-foreground/70 hover:no-underline disabled:opacity-60"
        disabled={resending || resendLocked}
        onClick={onResendCode}
        type="button"
        variant="link"
      >
        {resendLocked ? t('resend_wait') : t('resend_code')}
      </Button>
    </section>
  );
}
