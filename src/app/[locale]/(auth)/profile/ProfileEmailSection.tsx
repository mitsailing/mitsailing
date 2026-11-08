'use client';

import { useTranslations } from 'next-intl';
import type React from 'react';
import { useState } from 'react';
import { mapProfileEmailError } from '@/components/auth/profile/profileAuthErrorMaps';
import { ProfileInlineBanner } from '@/components/auth/profile/profileBanner';
import type { ProfileBannerState } from '@/components/auth/profile/profileBanner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import { authClientThrownMessage } from '@/libs/auth/authClientThrownMessage';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
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
}) {
  const tCommon = useTranslations('Common');
  const t = useTranslations('UserProfilePage');
  const [emailBanner, setEmailBanner] = useState<ProfileBannerState>(null);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);

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
    setChangingEmail(true);
    try {
      const res = await authClient.changeEmail({
        newEmail: normalizedNewEmail,
        callbackURL: '/profile',
      });
      if (res.error) {
        setEmailBanner({
          kind: 'error',
          message: mapProfileEmailError(res.error.code, res.error.message, t),
        });
        return;
      }
      setEmailBanner({ kind: 'success', message: t('email_change_sent') });
      setNewEmail('');
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'profile.email-change-request.thrown',
        code: undefined,
        message: authClientThrownMessage(caughtError),
      });
      setEmailBanner({
        kind: 'error',
        message: t('error_request_failed'),
      });
    } finally {
      setChangingEmail(false);
    }
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
