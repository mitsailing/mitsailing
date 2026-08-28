'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OtpCodeField } from '@/components/auth/OtpCodeField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import { safeAuthCallbackUrl } from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

type VerifyEmailFormProps = {
  callbackUrl: string;
  initialEmail: string;
  initialResendLocked?: boolean;
};

type BannerState = {
  kind: 'error' | 'success';
  message: string;
} | null;

type ResendTimerRef = {
  current: number | null;
};

type ResendLockTimers = {
  resendIntervalRef: ResendTimerRef;
  resendTimeoutRef: ResendTimerRef;
};

type ResendLockControls = ResendLockTimers & {
  setResendLocked: (locked: boolean) => void;
  setResendSecondsLeft: (
    value: number | ((previousSecondsLeft: number) => number)
  ) => void;
};

function clearResendLockTimers(options: ResendLockTimers) {
  clearTimeout(options.resendTimeoutRef.current ?? undefined);
  clearInterval(options.resendIntervalRef.current ?? undefined);
  options.resendTimeoutRef.current = null;
  options.resendIntervalRef.current = null;
}

function startResendLock(options: ResendLockControls) {
  clearResendLockTimers(options);
  options.setResendLocked(true);
  options.setResendSecondsLeft(30);
  options.resendIntervalRef.current = window.setInterval(() => {
    options.setResendSecondsLeft((prev) => {
      if (prev <= 1) {
        clearInterval(options.resendIntervalRef.current ?? undefined);
        options.resendIntervalRef.current = null;
        return 0;
      }
      return prev - 1;
    });
  }, 1000);
  options.resendTimeoutRef.current = window.setTimeout(() => {
    options.setResendLocked(false);
    options.resendTimeoutRef.current = null;
    clearInterval(options.resendIntervalRef.current ?? undefined);
    options.resendIntervalRef.current = null;
  }, 30_000);
}

export function VerifyEmailForm(props: VerifyEmailFormProps) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('VerifyEmailPage');
  const router = useRouter();
  const hasInitialEmail = isValidEmailAddress(
    normalizeEmailAddress(props.initialEmail)
  );
  const [email, setEmail] = useState(normalizeEmailAddress(props.initialEmail));
  const [code, setCode] = useState('');
  const [banner, setBanner] = useState<BannerState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendLocked, setResendLocked] = useState(
    props.initialResendLocked ?? false
  );
  const [resendSecondsLeft, setResendSecondsLeft] = useState(30);
  const resendTimeoutRef = useRef<number | null>(null);
  const resendIntervalRef = useRef<number | null>(null);

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
    if (message || codeValue) {
      reportUnknownAuthClientError({
        action: 'verify-email.unmapped-error',
        code: codeValue,
        message,
      });
    }
    return t('error_invalid_code');
  }

  useEffect(() => {
    if (props.initialResendLocked) {
      startResendLock({
        resendIntervalRef,
        resendTimeoutRef,
        setResendLocked,
        setResendSecondsLeft,
      });
    } else {
      clearResendLockTimers({ resendIntervalRef, resendTimeoutRef });
      setResendLocked(false);
    }

    return () => {
      clearResendLockTimers({ resendIntervalRef, resendTimeoutRef });
    };
  }, [props.initialResendLocked]);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    const normalizedEmail = normalizeEmailAddress(email);
    setEmail(normalizedEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      setBanner({ kind: 'error', message: t('error_invalid_email') });
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.emailOtp.verifyEmail({
        email: normalizedEmail,
        otp: code,
      });
      if (res.error) {
        setBanner({
          kind: 'error',
          message: mapError(res.error.code, res.error.message),
        });
        return;
      }
      router.push(safeAuthCallbackUrl(props.callbackUrl, '/'));
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'verify-email.submit.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setBanner({ kind: 'error', message: t('error_request_failed') });
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendCode() {
    setBanner(null);
    const normalizedEmail = normalizeEmailAddress(email);
    setEmail(normalizedEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
      setBanner({ kind: 'error', message: t('error_invalid_email') });
      return;
    }
    setResending(true);
    try {
      const res = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: 'email-verification',
      });
      if (res.error) {
        setBanner({
          kind: 'error',
          message: mapError(res.error.code, res.error.message),
        });
        return;
      }
      setBanner({ kind: 'success', message: t('resent_banner') });
      startResendLock({
        resendIntervalRef,
        resendTimeoutRef,
        setResendLocked,
        setResendSecondsLeft,
      });
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'verify-email.resend.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setBanner({ kind: 'error', message: t('error_request_failed') });
    } finally {
      setResending(false);
    }
  }

  return (
    <section className="flex flex-col items-center gap-8 text-center">
      <div className="flex flex-col items-center gap-4">
        <h1 className="text-center text-4xl font-normal tracking-normal text-foreground sm:text-5xl">
          {t('heading')}
        </h1>
        <p className="max-w-md text-xl leading-relaxed text-pretty text-muted-foreground">
          {hasInitialEmail
            ? t('pending_body', {
                email: normalizeEmailAddress(props.initialEmail),
              })
            : t('pending_body_fallback')}
        </p>
      </div>

      {banner ? (
        <p
          className={
            banner.kind === 'error'
              ? 'w-full rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm font-medium text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100'
              : 'w-full rounded-2xl border border-green-700/30 bg-green-50 px-4 py-3 text-sm font-medium text-green-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:bg-green-950/30 dark:text-green-100'
          }
          role={banner.kind === 'error' ? 'alert' : 'status'}
        >
          {banner.message}
        </p>
      ) : null}

      <form
        className="flex w-full flex-col gap-6"
        onSubmit={(event) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onSubmit(event);
        }}
      >
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

        <OtpCodeField
          id="code"
          inputClassName="h-14 rounded-full px-8 text-xl md:text-xl"
          label={t('code_label')}
          name="code"
          onValueChange={setCode}
          placeholder={t('code_placeholder')}
          value={code}
        />

        <SubmitButton
          className="h-14 min-h-11 w-full rounded-full bg-foreground text-lg font-normal text-background hover:bg-foreground/90"
          disabled={submitting || code.length !== 6}
          pending={submitting}
          pendingLabel={tCommon('pending_submitting')}
        >
          {t('submit')}
        </SubmitButton>
      </form>

      <Button
        className="h-auto min-h-11 px-0 py-0 text-lg font-normal text-foreground no-underline shadow-none hover:bg-transparent hover:text-foreground/70 hover:no-underline disabled:opacity-60"
        disabled={resending || resendLocked}
        onClick={() => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the resend promise.
          void onResendCode();
        }}
        type="button"
        variant="link"
      >
        {resendLocked
          ? tCommon('resend_wait', {
              seconds:
                resendSecondsLeft === 1
                  ? '1 second'
                  : `${resendSecondsLeft} seconds`,
            })
          : t('resend_email')}
      </Button>
    </section>
  );
}
