'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mapProfileDeleteError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';

type ProfileDeleteAccountClientProps = {
  signInHref: string;
};

export function ProfileDeleteAccountClient(
  props: ProfileDeleteAccountClientProps
) {
  const t = useTranslations('UserProfilePage');
  const tCommon = useTranslations('Common');
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
    try {
      const res = await authClient.deleteUser({ password: deletePassword });
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
    } catch {
      setDeleteBanner({
        kind: 'error',
        message: t('delete_unknown_error'),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('delete_page_heading')}</h1>

      <section
        aria-labelledby="delete-account-heading"
        className="rounded-lg border border-mit-red bg-mit-red-highlight p-6 shadow-sm"
      >
        <h2
          className="text-lg font-medium text-mit-red dark:text-mit-red-ink"
          id="delete-account-heading"
        >
          {t('delete_account_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('delete_account_description')}
        </p>
        <ProfileInlineBanner banner={deleteBanner} />
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
            void onDeleteAccount(event);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="deleteCurrentPassword">
              {t('current_password_label')}
            </Label>
            <Input
              autoComplete="current-password"
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="deleteConfirm">
              {t('delete_confirm_label')}
            </Label>
            <Input
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
          <SubmitButton
            className="mt-2 w-fit"
            pending={deleting}
            pendingLabel={tCommon('pending_deleting')}
            variant="destructive"
          >
            {t('delete_account_submit')}
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
