'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  authInlineLinkClassName,
  authInputClassName,
  authPrimaryButtonClassName,
} from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { Link as I18nLink } from '@/libs/I18nNavigation';

type UserProfileClientProps = {
  emailChangeCallbackUrl: string;
  initialEmail: string;
  initialName: string | null;
  initialUnconfirmedEmail: string | null;
  initialVerificationBanner: 'success' | 'error' | null;
  signInHref: string;
};

type Banner = { kind: 'success' | 'error'; message: React.ReactNode } | null;

function renderBanner(banner: Banner) {
  if (!banner) {
    return null;
  }
  const cls =
    banner.kind === 'success'
      ? 'mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800'
      : 'mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800';
  return (
    <p className={cls} role={banner.kind === 'error' ? 'alert' : undefined}>
      {banner.message}
    </p>
  );
}

// Client-rendered user profile page. All interactive flows go through
// `authClient.*` helpers so Better Auth's rate limits, hooks and session
// revocation on password reset are exercised directly.
export function UserProfileClient(props: UserProfileClientProps) {
  const t = useTranslations('UserProfilePage');
  const router = useRouter();

  let initialEmailBanner: Banner = null;
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

  const [emailBanner, setEmailBanner] = useState<Banner>(initialEmailBanner);
  const [passwordBanner, setPasswordBanner] = useState<Banner>(null);
  const [deleteBanner, setDeleteBanner] = useState<Banner>(null);
  const [sessionBanner, setSessionBanner] = useState<Banner>(null);
  const [resendBanner, setResendBanner] = useState<Banner>(null);

  const [pendingEmail, setPendingEmail] = useState<string | null>(
    props.initialUnconfirmedEmail
  );
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  const [changingEmail, setChangingEmail] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  function mapPassword(code: string | undefined, message: string | undefined) {
    if (code === 'PASSWORD_COMPROMISED') {
      return t('password_pwned_error');
    }
    if (code === 'INVALID_PASSWORD' || code === 'INVALID_EMAIL_OR_PASSWORD') {
      return t('password_invalid_error');
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return t('password_rate_limited');
    }
    return message ?? t('password_change_error');
  }

  function mapEmail(code: string | undefined, message: string | undefined) {
    if (code === 'EMAIL_EXISTS') {
      return t('email_exists_error');
    }
    if (code === 'INVALID_PASSWORD') {
      return t('email_invalid_password_error');
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return t('email_rate_limited_error');
    }
    return message ?? t('email_validation_error');
  }

  function mapDelete(code: string | undefined, message: string | undefined) {
    if (code === 'INVALID_PASSWORD' || code === 'INVALID_EMAIL_OR_PASSWORD') {
      return t('delete_invalid_password_error');
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return t('delete_rate_limited_error');
    }
    return message ?? t('delete_validation_error');
  }

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
        message: mapEmail(res.error.code, res.error.message),
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

  async function onChangePassword(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setPasswordBanner({
        kind: 'error',
        message: t('password_mismatch_error'),
      });
      return;
    }
    setPasswordBanner(null);
    setChangingPassword(true);
    const res = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    });
    setChangingPassword(false);
    if (res.error) {
      setPasswordBanner({
        kind: 'error',
        message: mapPassword(res.error.code, res.error.message),
      });
      return;
    }
    setPasswordBanner({ kind: 'success', message: t('password_changed') });
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  }

  async function onRevokeSessions() {
    setSessionBanner(null);
    setRevoking(true);
    const res = await authClient.revokeOtherSessions();
    setRevoking(false);
    if (res.error) {
      setSessionBanner({
        kind: 'error',
        message: res.error.message ?? t('sign_out_all_error'),
      });
      return;
    }
    setSessionBanner({
      kind: 'success',
      message: t('sign_out_all_success'),
    });
  }

  async function onDeleteAccount(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteConfirmation !== 'DELETE') {
      setDeleteBanner({
        kind: 'error',
        message: t('delete_validation_error'),
      });
      return;
    }
    setDeleteBanner(null);
    setDeleting(true);
    const res = await authClient.deleteUser({ password: deletePassword });
    setDeleting(false);
    if (res.error) {
      setDeleteBanner({
        kind: 'error',
        message: mapDelete(res.error.code, res.error.message),
      });
      return;
    }
    setDeleteBanner({ kind: 'success', message: t('delete_pending') });
    setDeletePassword('');
    setDeleteConfirmation('');
    router.push(props.signInHref);
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('heading')}</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="text-sm font-medium text-gray-600">{t('email')}</dt>
            <dd className="text-gray-900">{props.initialEmail}</dd>
          </div>
          {pendingEmail ? (
            <div>
              <dt className="text-sm font-medium text-gray-600">
                {t('pending_email_label')}
              </dt>
              <dd className="mt-1 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p>
                  {t.rich('pending_email_body', {
                    email: pendingEmail,
                    strong: (chunks) => <strong>{chunks}</strong>,
                  })}
                </p>
                {renderBanner(resendBanner)}
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <button
                    className="font-medium text-amber-900 underline disabled:opacity-60"
                    disabled={resendingEmail}
                    onClick={onResendPendingEmail}
                    type="button"
                  >
                    {t('pending_email_resend')}
                  </button>
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
          <div>
            <dt className="text-sm font-medium text-gray-600">{t('name')}</dt>
            <dd className="text-gray-900">{props.initialName ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-6 text-sm text-gray-600">
          {t('password_hint_forgot')}{' '}
          <I18nLink className={authInlineLinkClassName} href="/forgot-password">
            {t('reset_password_link')}
          </I18nLink>
        </p>
      </div>

      <section
        aria-labelledby="change-email-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-email-heading">
          {t('change_email_heading')}
        </h2>
        {renderBanner(emailBanner)}
        <form className="mt-4 flex flex-col gap-3" onSubmit={onChangeEmail}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
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
          <button
            className={`mt-2 w-fit ${authPrimaryButtonClassName}`}
            disabled={changingEmail}
            type="submit"
          >
            {t('change_email_submit')}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="change-password-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-password-heading">
          {t('change_password_heading')}
        </h2>
        {renderBanner(passwordBanner)}
        <form className="mt-4 flex flex-col gap-3" onSubmit={onChangePassword}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
              htmlFor="currentPassword"
            >
              {t('current_password_label')}
            </label>
            <input
              autoComplete="current-password"
              className={authInputClassName}
              id="currentPassword"
              name="currentPassword"
              onChange={(e) => {
                setCurrentPassword(e.target.value);
              }}
              required
              type="password"
              value={currentPassword}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
              htmlFor="newPassword"
            >
              {t('new_password_label')}
            </label>
            <input
              autoComplete="new-password"
              className={authInputClassName}
              id="newPassword"
              minLength={8}
              name="newPassword"
              onChange={(e) => {
                setNewPassword(e.target.value);
              }}
              required
              type="password"
              value={newPassword}
            />
            <span className="text-xs text-gray-500">
              {t('new_password_hint')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
              htmlFor="newPasswordConfirmation"
            >
              {t('new_password_confirmation_label')}
            </label>
            <input
              autoComplete="new-password"
              className={authInputClassName}
              id="newPasswordConfirmation"
              minLength={8}
              name="newPasswordConfirmation"
              onChange={(e) => {
                setNewPasswordConfirm(e.target.value);
              }}
              required
              type="password"
              value={newPasswordConfirm}
            />
          </div>
          <button
            className={`mt-2 w-fit ${authPrimaryButtonClassName}`}
            disabled={changingPassword}
            type="submit"
          >
            {t('change_password_submit')}
          </button>
        </form>
      </section>

      <section
        aria-labelledby="sign-out-all-heading"
        className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="sign-out-all-heading">
          {t('sign_out_all_heading')}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {t('sign_out_all_description')}
        </p>
        {renderBanner(sessionBanner)}
        <button
          className="mt-4 w-fit rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 disabled:opacity-60"
          disabled={revoking}
          onClick={onRevokeSessions}
          type="button"
        >
          {t('sign_out_all_submit')}
        </button>
      </section>

      <section
        aria-labelledby="delete-account-heading"
        className="rounded-lg border border-red-200 bg-white p-6 shadow-sm"
      >
        <h2
          className="text-lg font-medium text-red-700"
          id="delete-account-heading"
        >
          {t('delete_account_heading')}
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          {t('delete_account_description')}
        </p>
        {renderBanner(deleteBanner)}
        <form className="mt-4 flex flex-col gap-3" onSubmit={onDeleteAccount}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
              htmlFor="deleteCurrentPassword"
            >
              {t('current_password_label')}
            </label>
            <input
              autoComplete="current-password"
              className={authInputClassName}
              id="deleteCurrentPassword"
              name="currentPassword"
              onChange={(e) => {
                setDeletePassword(e.target.value);
              }}
              required
              type="password"
              value={deletePassword}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-gray-800"
              htmlFor="deleteConfirm"
            >
              {t('delete_confirm_label')}
            </label>
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-gray-900 ring-red-600 outline-none focus:ring-2"
              id="deleteConfirm"
              name="confirm"
              onChange={(e) => {
                setDeleteConfirmation(e.target.value);
              }}
              placeholder="DELETE"
              required
              type="text"
              value={deleteConfirmation}
            />
          </div>
          <button
            className="mt-2 w-fit rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            disabled={deleting}
            type="submit"
          >
            {t('delete_account_submit')}
          </button>
        </form>
      </section>
    </div>
  );
}
