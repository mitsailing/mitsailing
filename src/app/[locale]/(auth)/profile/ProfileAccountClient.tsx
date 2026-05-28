'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { OtpCodeField } from '@/components/auth/OtpCodeField';
import { ProfileAppearanceSection } from '@/components/auth/profile/ProfileAppearanceSection';
import { mapProfileEmailError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import type { ThemePreferenceValue } from '@/lib/mit-sailing/themePreference';
import { authClient } from '@/libs/auth-client';
import { updateProfileContactAction } from '@/libs/auth/profileContactActions';
import type { UpdateProfileContactResult } from '@/libs/auth/profileContactActions';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';
import { formatPhoneForDisplay } from '@/utils/phoneValidation';

type ProfileAccountClientProps = {
  initialEmail: string;
  initialEmailDeliverabilityStatus: 'ok' | 'bounced' | 'suppressed';
  initialEmergencyContactName: string;
  initialEmergencyContactPhone: string;
  initialName: string | null;
  initialPhone: string;
  initialThemePreference: ThemePreferenceValue;
  initialUnconfirmedEmail: string | null;
  locale: string;
};

type ActiveEmailDeliverabilityStatus = Exclude<
  ProfileAccountClientProps['initialEmailDeliverabilityStatus'],
  'ok'
>;

const emailDeliverabilityTitleKeys = {
  bounced: 'email_deliverability_bounced_title',
  suppressed: 'email_deliverability_suppressed_title',
} as const satisfies Record<ActiveEmailDeliverabilityStatus, string>;

const emailDeliverabilityBodyKeys = {
  bounced: 'email_deliverability_bounced_body',
  suppressed: 'email_deliverability_suppressed_body',
} as const satisfies Record<ActiveEmailDeliverabilityStatus, string>;

type ContactErrorMessageKey =
  | 'contact_emergency_incomplete'
  | 'contact_emergency_phone_invalid'
  | 'contact_phone_invalid'
  | 'contact_update_error';

function contactErrorMessageKey(
  error: Exclude<UpdateProfileContactResult, { ok: true }>['error']
): ContactErrorMessageKey {
  if (error === 'invalid_phone') {
    return 'contact_phone_invalid';
  }
  if (error === 'invalid_emergency_phone') {
    return 'contact_emergency_phone_invalid';
  }
  if (error === 'incomplete_emergency_contact') {
    return 'contact_emergency_incomplete';
  }
  return 'contact_update_error';
}

export function ProfileAccountClient(props: ProfileAccountClientProps) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const router = useRouter();

  const [emailBanner, setEmailBanner] = useState<ProfileBannerState>(null);
  const [emailOtpBanner, setEmailOtpBanner] =
    useState<ProfileBannerState>(null);
  const [contactBanner, setContactBanner] = useState<ProfileBannerState>(null);
  const [nameBanner, setNameBanner] = useState<ProfileBannerState>(null);
  const [resendBanner, setResendBanner] = useState<ProfileBannerState>(null);

  const [pendingEmail, setPendingEmail] = useState<string | null>(
    props.initialUnconfirmedEmail
  );
  const [phone, setPhone] = useState(formatPhoneForDisplay(props.initialPhone));
  const [emergencyContactName, setEmergencyContactName] = useState(
    props.initialEmergencyContactName
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    formatPhoneForDisplay(props.initialEmergencyContactPhone)
  );
  const [currentEmail, setCurrentEmail] = useState(props.initialEmail);
  const [displayName, setDisplayName] = useState(props.initialName ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(30);
  const [updatingContact, setUpdatingContact] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);
  const resendTimerRef = useRef<number | null>(null);
  const resendIntervalRef = useRef<number | null>(null);
  const deliverabilityStatus =
    props.initialEmailDeliverabilityStatus === 'ok'
      ? null
      : props.initialEmailDeliverabilityStatus;

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
    const normalizedCurrentEmail = normalizeEmailAddress(currentEmail);
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
      setPendingEmail(normalizedNewEmail);
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
    event: React.SubmitEvent<HTMLFormElement>;
    emailToConfirm: string;
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
      setCurrentEmail(options.emailToConfirm);
      setPendingEmail(null);
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
    if (!pendingEmail) {
      return;
    }
    await onConfirmPendingEmail({
      event,
      emailToConfirm: pendingEmail,
    });
  }

  async function onUpdateName(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed === (props.initialName ?? '').trim()) {
      setNameBanner({ kind: 'error', message: t('name_unchanged_error') });
      return;
    }
    setNameBanner(null);
    setUpdatingName(true);
    try {
      const res = await authClient.updateUser({
        name: trimmed,
      });
      if (res.error) {
        setNameBanner({
          kind: 'error',
          message: t('name_update_error'),
        });
        return;
      }
      setNameBanner({ kind: 'success', message: t('name_updated') });
      router.refresh();
    } catch {
      setNameBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setUpdatingName(false);
    }
  }

  async function onUpdateContact(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setContactBanner(null);
    setUpdatingContact(true);
    try {
      const result = await updateProfileContactAction(props.locale, {
        emergencyContactName,
        emergencyContactPhone,
        phone,
      });
      if (!result.ok) {
        setContactBanner({
          kind: 'error',
          message: t(contactErrorMessageKey(result.error)),
        });
        return;
      }
      setContactBanner({ kind: 'success', message: t('contact_updated') });
      router.refresh();
    } catch {
      setContactBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setUpdatingContact(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('account_page_heading')}</h1>
      {deliverabilityStatus ? (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
          role="alert"
        >
          <p className="font-semibold">
            {t(emailDeliverabilityTitleKeys[deliverabilityStatus])}
          </p>
          <p className="mt-1">
            {t(emailDeliverabilityBodyKeys[deliverabilityStatus])}
          </p>
        </div>
      ) : null}

      <div className="rounded-lg border border-mit-line bg-card p-6 shadow-sm">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-sm font-medium text-mit-text">{t('email')}</dt>
            <dd className="text-mit-text">{currentEmail}</dd>
          </div>
          {pendingEmail ? (
            <div>
              <dt className="text-sm font-medium text-mit-text">
                {t('pending_email_label')}
              </dt>
              <dd className="mt-1 rounded-2xl bg-amber-50 px-4 py-4 text-sm text-amber-900">
                <p className="text-base font-medium text-amber-950">
                  {t('pending_email_heading')}
                </p>
                <p className="mt-1">
                  {t.rich('pending_email_body', {
                    email: pendingEmail,
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
                    labelClassName="not-sr-only text-amber-950"
                    name="emailCode"
                    onValueChange={setEmailCode}
                    pasteButtonClassName="text-amber-900 hover:text-amber-950"
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
                    className="h-auto min-h-0 px-0 py-0 font-medium text-amber-900 underline shadow-none hover:bg-transparent hover:text-amber-950 hover:underline disabled:opacity-60"
                    disabled={resendingEmail || resendLocked}
                    onClick={() => {
                      // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the resend promise.
                      void onResendPendingEmail(pendingEmail);
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
                  <span className="text-amber-800">
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
      </div>

      <section
        aria-labelledby="update-name-heading"
        className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="update-name-heading">
          {t('update_name_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('update_name_description')}
        </p>
        <ProfileInlineBanner banner={nameBanner} />
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
            void onUpdateName(event);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="displayName">
              {t('name')}
            </Label>
            <Input
              autoComplete="name"
              id="displayName"
              name="displayName"
              onChange={(e) => {
                setDisplayName(e.target.value);
              }}
              type="text"
              value={displayName}
            />
          </div>
          <SubmitButton
            className="mt-2 w-fit"
            pending={updatingName}
            pendingLabel={tCommon('pending_saving')}
            variant="mit"
          >
            {t('name_save')}
          </SubmitButton>
        </form>
      </section>

      <ProfileAppearanceSection
        initialPreference={props.initialThemePreference}
      />

      <section
        aria-labelledby="contact-heading"
        className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="contact-heading">
          {t('contact_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">{t('contact_description')}</p>
        <ProfileInlineBanner banner={contactBanner} />
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
            void onUpdateContact(event);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="phone">
              {t('phone')}
            </Label>
            <Input
              autoComplete="tel"
              id="phone"
              inputMode="tel"
              name="phone"
              onChange={(event) => {
                setPhone(event.currentTarget.value);
              }}
              required
              type="tel"
              value={phone}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="emergencyContactName">
              {t('emergency_contact_name')}
            </Label>
            <Input
              autoComplete="name"
              id="emergencyContactName"
              name="emergencyContactName"
              onChange={(event) => {
                setEmergencyContactName(event.currentTarget.value);
              }}
              type="text"
              value={emergencyContactName}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="emergencyContactPhone">
              {t('emergency_contact_phone')}
            </Label>
            <Input
              autoComplete="tel"
              id="emergencyContactPhone"
              inputMode="tel"
              name="emergencyContactPhone"
              onChange={(event) => {
                setEmergencyContactPhone(event.currentTarget.value);
              }}
              type="tel"
              value={emergencyContactPhone}
            />
          </div>
          <SubmitButton
            className="mt-2 w-fit"
            pending={updatingContact}
            pendingLabel={tCommon('pending_saving')}
            variant="mit"
          >
            {t('contact_save')}
          </SubmitButton>
        </form>
      </section>

      <section
        aria-labelledby="change-email-heading"
        className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-email-heading">
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
              onChange={(e) => {
                setNewEmail(e.target.value);
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
    </div>
  );
}
