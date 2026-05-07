'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ProfileAppearanceSection } from '@/components/auth/profile/ProfileAppearanceSection';
import { mapProfileEmailError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ThemePreferenceValue } from '@/lib/mit-sailing/themePreference';
import { authClient } from '@/libs/auth-client';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type ProfileAccountClientProps = {
  initialEmail: string;
  initialName: string | null;
  initialThemePreference: ThemePreferenceValue;
  initialUnconfirmedEmail: string | null;
  initialVerificationBanner: 'success' | 'error' | null;
};

export function ProfileAccountClient(props: ProfileAccountClientProps) {
  const t = useTranslations('UserProfilePage');
  const router = useRouter();

  let initialEmailBanner: ProfileBannerState = null;
  if (props.initialVerificationBanner === 'success') {
    initialEmailBanner = {
      kind: 'success',
      message: t('email_change_confirmed'),
    };
  } else if (props.initialVerificationBanner === 'error') {
    initialEmailBanner = {
      kind: 'error',
      message: t('email_change_error_banner'),
    };
  }

  const [emailBanner, setEmailBanner] =
    useState<ProfileBannerState>(initialEmailBanner);
  const [nameBanner, setNameBanner] = useState<ProfileBannerState>(null);
  const [resendBanner, setResendBanner] = useState<ProfileBannerState>(null);

  const [pendingEmail, setPendingEmail] = useState<string | null>(
    props.initialUnconfirmedEmail
  );
  const [displayName, setDisplayName] = useState(props.initialName ?? '');
  const [newEmail, setNewEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [confirmingEmail, setConfirmingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [resendLocked, setResendLocked] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  function lockEmailResend() {
    setResendLocked(true);
    window.setTimeout(() => {
      setResendLocked(false);
    }, 30_000);
  }

  async function onChangeEmail(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newEmail || newEmail === props.initialEmail) {
      setEmailBanner({ kind: 'error', message: t('email_same_error') });
      return;
    }
    if (!isValidMarketingEmail(newEmail)) {
      setEmailBanner({ kind: 'error', message: t('email_validation_error') });
      return;
    }
    setEmailBanner(null);
    setResendBanner(null);
    setChangingEmail(true);
    const res = await authClient.emailOtp.requestEmailChange({
      newEmail,
    });
    setChangingEmail(false);
    if (res.error) {
      setEmailBanner({
        kind: 'error',
        message: mapProfileEmailError(res.error.code, res.error.message, t),
      });
      return;
    }
    setEmailBanner({ kind: 'success', message: t('email_change_sent') });
    setPendingEmail(newEmail);
    setEmailCode('');
    setNewEmail('');
  }

  async function onConfirmPendingEmail(
    event: React.SubmitEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    if (!pendingEmail) {
      return;
    }
    if (emailCode.length !== 6) {
      setEmailBanner({
        kind: 'error',
        message: t('email_invalid_code_error'),
      });
      return;
    }
    setEmailBanner(null);
    setConfirmingEmail(true);
    const res = await authClient.emailOtp.changeEmail({
      newEmail: pendingEmail,
      otp: emailCode,
    });
    setConfirmingEmail(false);
    if (res.error) {
      setEmailBanner({
        kind: 'error',
        message: mapProfileEmailError(res.error.code, res.error.message, t),
      });
      return;
    }
    setEmailBanner({ kind: 'success', message: t('email_change_confirmed') });
    setPendingEmail(null);
    setEmailCode('');
    router.refresh();
  }

  async function onResendPendingEmail() {
    if (!pendingEmail) {
      return;
    }
    setResendBanner(null);
    setResendingEmail(true);
    const res = await authClient.emailOtp.requestEmailChange({
      newEmail: pendingEmail,
    });
    setResendingEmail(false);
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
        email: pendingEmail,
        strong: (chunks) => <strong>{chunks}</strong>,
      }),
    });
    lockEmailResend();
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
    const res = await authClient.updateUser({
      name: trimmed,
    });
    setUpdatingName(false);
    if (res.error) {
      setNameBanner({
        kind: 'error',
        message: res.error.message ?? t('name_update_error'),
      });
      return;
    }
    setNameBanner({ kind: 'success', message: t('name_updated') });
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('account_page_heading')}</h1>

      <div className="rounded-lg border border-mit-line bg-card p-6 shadow-sm">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-sm font-medium text-mit-text">{t('email')}</dt>
            <dd className="text-mit-text">{props.initialEmail}</dd>
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
                  onSubmit={onConfirmPendingEmail}
                >
                  <Label className="text-amber-950" htmlFor="emailCode">
                    {t('pending_email_code_label')}
                  </Label>
                  <Input
                    autoComplete="one-time-code"
                    className="h-12 max-w-64 rounded-full bg-white px-5 text-base md:text-base"
                    enterKeyHint="done"
                    id="emailCode"
                    inputMode="numeric"
                    maxLength={6}
                    minLength={6}
                    name="emailCode"
                    onChange={(e) => {
                      setEmailCode(
                        e.target.value.replaceAll(/\D/g, '').slice(0, 6)
                      );
                    }}
                    pattern="[0-9]{6}"
                    placeholder={t('pending_email_code_placeholder')}
                    required
                    type="text"
                    value={emailCode}
                  />
                  <Button
                    className="h-11 w-fit rounded-full px-5"
                    disabled={confirmingEmail || emailCode.length !== 6}
                    type="submit"
                    variant="mit"
                  >
                    {t('pending_email_confirm')}
                  </Button>
                </form>
                <ProfileInlineBanner banner={resendBanner} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    className="h-auto min-h-0 px-0 py-0 font-medium text-amber-900 underline shadow-none hover:bg-transparent hover:text-amber-950 hover:underline disabled:opacity-60"
                    disabled={resendingEmail || resendLocked}
                    onClick={onResendPendingEmail}
                    type="button"
                    variant="link"
                  >
                    {resendLocked
                      ? t('pending_email_resend_wait')
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
        <form className="mt-4 flex flex-col gap-3" onSubmit={onUpdateName}>
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
          <Button
            className="mt-2 w-fit"
            disabled={updatingName}
            type="submit"
            variant="mit"
          >
            {t('name_save')}
          </Button>
        </form>
      </section>

      <ProfileAppearanceSection
        initialPreference={props.initialThemePreference}
      />

      <section
        aria-labelledby="change-email-heading"
        className="rounded-lg border border-mit-line bg-card p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-email-heading">
          {t('change_email_heading')}
        </h2>
        <ProfileInlineBanner banner={emailBanner} />
        <form className="mt-4 flex flex-col gap-3" onSubmit={onChangeEmail}>
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
          <Button
            className="mt-2 w-fit"
            disabled={changingEmail}
            type="submit"
            variant="mit"
          >
            {t('change_email_submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
