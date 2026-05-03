'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mapProfileDeleteError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Button } from '@/components/ui/button';
import { authInputClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';

type ProfileDeleteAccountClientProps = {
  signInHref: string;
};

export function ProfileDeleteAccountClient(
  props: ProfileDeleteAccountClientProps
) {
  const t = useTranslations('UserProfilePage');
  const router = useRouter();

  const [deleteBanner, setDeleteBanner] = useState<ProfileBannerState>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);

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
        message: mapProfileDeleteError(res.error.code, res.error.message, t),
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
      <h1 className="text-2xl font-semibold">{t('delete_page_heading')}</h1>

      <section
        aria-labelledby="delete-account-heading"
        className="rounded-lg border border-mit-red bg-mit-red-highlight p-6 shadow-sm"
      >
        <h2
          className="text-lg font-medium text-mit-red"
          id="delete-account-heading"
        >
          {t('delete_account_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('delete_account_description')}
        </p>
        <ProfileInlineBanner banner={deleteBanner} />
        <form className="mt-4 flex flex-col gap-3" onSubmit={onDeleteAccount}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-mit-text"
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
              className="text-sm font-medium text-mit-text"
              htmlFor="deleteConfirm"
            >
              {t('delete_confirm_label')}
            </label>
            <input
              className="rounded-md border border-mit-line bg-white px-3 py-2 text-mit-text outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2"
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
          <Button
            className="mt-2 w-fit"
            disabled={deleting}
            type="submit"
            variant="destructive"
          >
            {t('delete_account_submit')}
          </Button>
        </form>
      </section>
    </div>
  );
}
