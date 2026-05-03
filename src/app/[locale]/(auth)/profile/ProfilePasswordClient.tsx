'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { mapProfilePasswordError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import {
  authInlineLinkClassName,
  authInputClassName,
} from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { Link as I18nLink } from '@/libs/I18nNavigation';

export function ProfilePasswordClient() {
  const t = useTranslations('UserProfilePage');

  const [passwordBanner, setPasswordBanner] =
    useState<ProfileBannerState>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
        message: mapProfilePasswordError(res.error.code, res.error.message, t),
      });
      return;
    }
    setPasswordBanner({ kind: 'success', message: t('password_changed') });
    setCurrentPassword('');
    setNewPassword('');
    setNewPasswordConfirm('');
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('password_page_heading')}</h1>

      <section
        aria-labelledby="change-password-heading"
        className="rounded-lg border border-mit-line bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-password-heading">
          {t('change_password_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('password_hint_forgot')}{' '}
          <I18nLink className={authInlineLinkClassName} href="/forgot-password">
            {t('reset_password_link')}
          </I18nLink>
        </p>
        <ProfileInlineBanner banner={passwordBanner} />
        <form className="mt-4 flex flex-col gap-3" onSubmit={onChangePassword}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-mit-text"
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
              className="text-sm font-medium text-mit-text"
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
            <span className="text-xs text-mit-text">
              {t('new_password_hint')}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-mit-text"
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
          <Button
            className="mt-2 w-fit"
            disabled={changingPassword}
            type="submit"
          >
            {t('change_password_submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
