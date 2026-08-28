'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { mapProfilePasswordError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { Link as I18nLink } from '@/libs/I18nNavigation';

export function ProfilePasswordClient() {
  const t = useTranslations('UserProfilePage');
  const tCommon = useTranslations('Common');
  const { data, refetch: refetchSession } = authClient.useSession();

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
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (error) {
        setPasswordBanner({
          kind: 'error',
          message: mapProfilePasswordError(error.code, error.message, t),
        });
        return;
      }
      try {
        await refetchSession();
      } catch (refetchError) {
        Sentry.captureException(refetchError, {
          extra: {
            action: 'refetchSession after password change',
            userId: data?.user.id ?? undefined,
          },
        });
        // Best-effort: password change already succeeded on the server.
      }
      setPasswordBanner({ kind: 'success', message: t('password_changed') });
      setCurrentPassword('');
      setNewPassword('');
      setNewPasswordConfirm('');
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'profile.password-change.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      setPasswordBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('password_page_heading')}</h1>

      <section
        aria-labelledby="change-password-heading"
        className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <h2 className="text-lg font-medium" id="change-password-heading">
          {t('change_password_heading')}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('password_hint_forgot')}{' '}
          <I18nLink className={authInlineLinkClassName} href="/forgot-password">
            {t('reset_password_link')}
          </I18nLink>
        </p>
        <ProfileInlineBanner banner={passwordBanner} />
        <form
          aria-busy={changingPassword || undefined}
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
            void onChangePassword(event);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="currentPassword">
              {t('current_password_label')}
            </Label>
            <Input
              autoComplete="current-password"
              disabled={changingPassword}
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
          <div className="flex flex-col gap-1.5">
            <Label className="text-foreground" htmlFor="newPassword">
              {t('new_password_label')}
            </Label>
            <Input
              autoComplete="new-password"
              disabled={changingPassword}
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
            <span className="text-xs text-muted-foreground">
              {t('new_password_hint')}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label
              className="text-foreground"
              htmlFor="newPasswordConfirmation"
            >
              {t('new_password_confirmation_label')}
            </Label>
            <Input
              autoComplete="new-password"
              disabled={changingPassword}
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
          <SubmitButton
            className="mt-2 w-fit"
            pending={changingPassword}
            pendingLabel={tCommon('pending_saving')}
            variant="mit"
          >
            {t('change_password_submit')}
          </SubmitButton>
        </form>
      </section>
    </div>
  );
}
