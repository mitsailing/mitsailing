'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';

export function ProfileSecurityClient() {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const [sessionBanner, setSessionBanner] = useState<ProfileBannerState>(null);
  const [revoking, setRevoking] = useState(false);

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

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t('security_page_heading')}</h1>

      <section
        aria-labelledby="sign-out-all-heading"
        className="rounded-lg border border-border bg-card p-6 text-card-foreground shadow-sm"
      >
        <h2 className="text-lg font-medium" id="sign-out-all-heading">
          {t('sign_out_all_heading')}
        </h2>
        <p className="mt-2 text-sm text-mit-text">
          {t('sign_out_all_description')}
        </p>
        <ProfileInlineBanner banner={sessionBanner} />
        <SubmitButton
          className="mt-4 w-fit"
          onClick={onRevokeSessions}
          pending={revoking}
          pendingLabel={tCommon('pending_submitting')}
          type="button"
          variant="outline"
        >
          {t('sign_out_all_submit')}
        </SubmitButton>
      </section>
    </div>
  );
}
