'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { OtpCodeField } from '@/components/auth/OtpCodeField';
import { mapProfileEmailError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

type ActiveEmailDeliverabilityStatus = 'bounced' | 'suppressed';

const emailDeliverabilityTitleKeys = {
  bounced: 'email_deliverability_bounced_title',
  suppressed: 'email_deliverability_suppressed_title',
} as const satisfies Record<ActiveEmailDeliverabilityStatus, string>;

const emailDeliverabilityBodyKeys = {
  bounced: 'email_deliverability_bounced_body',
  suppressed: 'email_deliverability_suppressed_body',
} as const satisfies Record<ActiveEmailDeliverabilityStatus, string>;

function EmailDeliverabilityNotice(props: {
  readonly status: ActiveEmailDeliverabilityStatus | null;
}) {
  const t = useTranslations('UserProfilePage');
  if (!props.status) {
    return null;
  }
  return (
    <div
      className="rounded-lg border border-mit-red-200 bg-mit-red-50 p-4 text-sm text-mit-red-900 dark:border-mit-red-700 dark:bg-mit-red-950/70 dark:text-mit-red-100"
      role="alert"
    >
      <p className="font-semibold">
        {t(emailDeliverabilityTitleKeys[props.status])}
      </p>
      <p className="mt-1">{t(emailDeliverabilityBodyKeys[props.status])}</p>
    </div>
  );
}

export function ProfileEmailSection(props: {
  readonly currentEmail: string;
  readonly deliverabilityStatus: ActiveEmailDeliverabilityStatus | null;
  readonly onCurrentEmailChange: (value: string) => void;
  readonly onPendingEmailChange: (value: string | null) => void;
  readonly pendingEmail: string | null;
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const router = useRouter();
  const [emailBanner, setEmailBanner] = useState<ProfileBannerState>(null);
  const [emailOtpBanner, setEmailOtpBanner] =
    useState<ProfileBannerState>(null);
  const [resendBanner, setResendBanner] = useState<ProfileBannerState>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(30);
  const resendTimerRef = useRef<number | null>(null);
  const resendIntervalRef = useRef<number | null>(null);

  function lockEmailResend() {
    clearTimeout(resendTimerRef.current ?? undefined);
    clearInterval(resendIntervalRef.current ?? undefined);
    resendTimerRef.current = null;
    resendIntervalRef.current = null;
    setResendLocked(true);
    setResendSecondsLeft(30);
    resendIntervalRef.current = window.setInterval(() => {
      setResendSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(resendIntervalRef.current ?? undefined);
          resendIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    resendTimerRef.current = window.setTimeout(() => {
      setResendLocked(false);
      resendTimerRef.current = null;
      clearInterval(resendIntervalRef.current ?? undefined);
      resendIntervalRef.current = null;
    }, 30_000);
  }

  useEffect(
    () => () => {
      clearTimeout(resendTimerRef.current ?? undefined);
      clearInterval(resendIntervalRef.current ?? undefined);
      resendTimerRef.current = null;
      resendIntervalRef.current = null;
    },
    []
  );

  async function onChangeEmail(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedNewEmail = normalizeEmailAddress(newEmail);
    const normalizedCurrentEmail = normalizeEmailAddress(props.currentEmail);
    if (!normalizedNewEmail || !isValidEmailAddress(normalizedNewEmail)) {
      setEmailBanner({ kind: 'error', message: t('email_validation_error') });
      return;
    }
    if (normalizedNewEmail === normalizedCurrentEmail) {
      setEmailBanner({ kind: 'error', message: t('email_same_error') });
      return;
    }
    setEmailBanner(null);
    setResendBanner(null);
    setChangingEmail(true);
    try {
      const res = await authClient.emailOtp.requestEmailChange({
        newEmail: normalizedNewEmail,
      });
      if (res.error) {
        setEmailBanner({
          kind: 'error',
          message: mapProfileEmailError(res.error.code, res.error.message, t),
        });
        return;
      }
      setEmailBanner({ kind: 'success', message: t('email_change_sent') });
      setEmailOtpBanner(null);
      lockEmailResend();
      props.onPendingEmailChange(normalizedNewEmail);
      setEmailCode('');
      setNewEmail('');
    } catch {
      setEmailBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setChangingEmail(false);
    }
  }

  async function onConfirmPendingEmail(options: {
    readonly emailToConfirm: string;
    readonly event: React.SubmitEvent<HTMLFormElement>;
  }) {
    options.event.preventDefault();
    setEmailOtpBanner(null);
    setConfirmingEmail(true);
    try {
      const res = await authClient.emailOtp.changeEmail({
        newEmail: options.emailToConfirm,
        otp: emailCode,
      });
      if (res.error) {
        setEmailOtpBanner({
          kind: 'error',
          message: mapProfileEmailError(res.error.code, res.error.message, t),
        });
        return;
      }
      setEmailBanner({ kind: 'success', message: t('email_change_confirmed') });
      props.onCurrentEmailChange(options.emailToConfirm);
      props.onPendingEmailChange(null);
      setEmailCode('');
      router.refresh();
    } catch {
      setEmailOtpBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setConfirmingEmail(false);
    }
  }

  async function onResendPendingEmail(emailToConfirm: string) {
    setResendBanner(null);
    setResendingEmail(true);
    try {
      const res = await authClient.emailOtp.requestEmailChange({
        newEmail: emailToConfirm,
      });
      if (res.error) {
        setResendBanner({
          kind: 'error',
          message: t('pending_email_resend_error'),
        });
        return;
      }
      setResendBanner({
        kind: 'success',
        message: t.rich('pending_email_resent', {
          email: emailToConfirm,
          strong: (chunks) => <strong>{chunks}</strong>,
        }),
      });
      lockEmailResend();
    } catch {
      setResendBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setResendingEmail(false);
    }
  }

  async function onConfirmPendingEmailSubmit(
    event: React.SubmitEvent<HTMLFormElement>
  ) {
    if (!props.pendingEmail) {
      return;
    }
    await onConfirmPendingEmail({
      emailToConfirm: props.pendingEmail,
      event,
    });
  }

  return (
    <>
      <EmailDeliverabilityNotice status={props.deliverabilityStatus} />
      <section
        aria-labelledby="change-email-heading"
        className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
        id="change-email-section"
      >
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-sm font-medium text-mit-text">{t('email')}</dt>
            <dd className="text-mit-text">{props.currentEmail}</dd>
          </div>
          {props.pendingEmail ? (
            <div>
              <dt className="text-sm font-medium text-mit-text">
                {t('pending_email_label')}
              </dt>
              <dd className="mt-1 rounded-lg border border-mit-line bg-muted/60 px-4 py-4 text-sm text-mit-readable-ink">
                <p className="text-base font-medium text-foreground">
                  {t('pending_email_heading')}
                </p>
                <p className="mt-1">
                  {t.rich('pending_email_body', {
                    email: props.pendingEmail,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(event) => {
                    // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
                    void onConfirmPendingEmailSubmit(event);
                  }}
                >
                  <OtpCodeField
                    id="emailCode"
                    inputClassName="h-12 max-w-64 rounded-full bg-white px-5 text-base md:text-base"
                    label={t('pending_email_code_label')}
                    labelClassName="not-sr-only text-foreground"
                    name="emailCode"
                    onValueChange={setEmailCode}
                    pasteButtonClassName="text-primary-ink hover:text-mit-red"
                    pasteLabel={tCommon('paste_code')}
                    placeholder={t('pending_email_code_placeholder')}
                    value={emailCode}
                  />
                  <SubmitButton
                    className="h-11 w-fit rounded-full px-5"
                    disabled={emailCode.length !== 6}
                    pending={confirmingEmail}
                    pendingLabel={tCommon('pending_submitting')}
                    variant="mit"
                  >
                    {t('pending_email_confirm')}
                  </SubmitButton>
                </form>
                <ProfileInlineBanner banner={emailOtpBanner} />
                <ProfileInlineBanner banner={resendBanner} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    className="h-auto min-h-0 px-0 py-0 font-medium text-primary-ink underline shadow-none hover:bg-transparent hover:text-mit-red hover:underline disabled:opacity-60"
                    disabled={resendingEmail || resendLocked}
                    onClick={() => {
                      if (props.pendingEmail) {
                        // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the resend promise.
                        void onResendPendingEmail(props.pendingEmail);
                      }
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
                      : t('pending_email_resend')}
                  </Button>
                  <span className="text-muted-foreground">
                    {t.rich('pending_email_support', {
                      support: (chunks) => (
                        <a
                          className="underline"
                          href="mailto:support@mitsailing.com"
                        >
                          {chunks}
                        </a>
                      ),
                    })}
                  </span>
                </div>
              </dd>
            </div>
          ) : null}
        </dl>

        <h2 className="mt-6 text-lg font-medium" id="change-email-heading">
          {t('change_email_heading')}
        </h2>
        <ProfileInlineBanner banner={emailBanner} />
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
            void onChangeEmail(event);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="newEmail">
              {t('new_email_label')}
            </Label>
            <Input
              autoComplete="email"
              id="newEmail"
              name="newEmail"
              onChange={(event) => {
                setNewEmail(event.currentTarget.value);
              }}
              required
              type="email"
              value={newEmail}
            />
          </div>
          <SubmitButton
            className="mt-2 w-fit"
            pending={changingEmail}
            pendingLabel={tCommon('pending_saving')}
            variant="mit"
          >
            {t('change_email_submit')}
          </SubmitButton>
        </form>
      </section>
    </>
  );
}
