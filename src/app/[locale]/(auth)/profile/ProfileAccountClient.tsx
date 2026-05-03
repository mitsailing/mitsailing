'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mapProfileEmailError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import { authInputClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';

type ProfileAccountClientProps = {
  emailChangeCallbackUrl: string;
  initialEmail: string;
  initialName: string | null;
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

  const [changingEmail, setChangingEmail] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [updatingName, setUpdatingName] = useState(false);

  async function onChangeEmail(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newEmail || newEmail === props.initialEmail) {
      setEmailBanner({ kind: 'error', message: t('email_same_error') });
      return;
    }
    setEmailBanner(null);
    setResendBanner(null);
    setChangingEmail(true);
    const res = await authClient.changeEmail({
      newEmail,
      callbackURL: props.emailChangeCallbackUrl,
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
    setNewEmail('');
  }

  async function onResendPendingEmail() {
    if (!pendingEmail) {
      return;
    }
    setResendBanner(null);
    setResendingEmail(true);
    const res = await authClient.changeEmail({
      newEmail: pendingEmail,
      callbackURL: props.emailChangeCallbackUrl,
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

      <div className="rounded-lg border border-mit-line bg-white p-6 shadow-sm">
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
              <dd className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>
                  {t.rich('pending_email_body', {
                    email: pendingEmail,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                <ProfileInlineBanner banner={resendBanner} />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Button
                    className="h-auto min-h-0 px-0 py-0 font-medium text-amber-900 underline shadow-none hover:bg-transparent hover:text-amber-950 hover:underline disabled:opacity-60"
                    disabled={resendingEmail}
                    onClick={onResendPendingEmail}
                    type="button"
                    variant="link"
                  >
                    {t('pending_email_resend')}
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
        className="rounded-lg border border-mit-line bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="update-name-heading">
          {t('update_name_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('update_name_description')}
        </p>
        <ProfileInlineBanner banner={nameBanner} />
        <form className="mt-4 flex flex-col gap-3" onSubmit={onUpdateName}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-mit-text"
              htmlFor="displayName"
            >
              {t('name')}
            </label>
            <input
              autoComplete="name"
              className={authInputClassName}
              id="displayName"
              name="displayName"
              onChange={(e) => {
                setDisplayName(e.target.value);
              }}
              type="text"
              value={displayName}
            />
          </div>
          <Button className="mt-2 w-fit" disabled={updatingName} type="submit">
            {t('name_save')}
          </Button>
        </form>
      </section>

      <section
        aria-labelledby="change-email-heading"
        className="rounded-lg border border-mit-line bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-email-heading">
          {t('change_email_heading')}
        </h2>
        <ProfileInlineBanner banner={emailBanner} />
        <form className="mt-4 flex flex-col gap-3" onSubmit={onChangeEmail}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-mit-text"
              htmlFor="newEmail"
            >
              {t('new_email_label')}
            </label>
            <input
              autoComplete="email"
              className={authInputClassName}
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
          <Button className="mt-2 w-fit" disabled={changingEmail} type="submit">
            {t('change_email_submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
