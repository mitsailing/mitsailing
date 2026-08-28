'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';

type ImpersonateButtonProps = {
  userId: string;
  redirectHref: string;
};

// Client leaf for the server-rendered admin page: impersonation uses
// `authClient` + router and must not force the whole route to `'use client'`.
export function ImpersonateButton(props: ImpersonateButtonProps) {
  const t = useTranslations('AdminPage');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await authClient.admin.impersonateUser({
        userId: props.userId,
      });
      if (res.error) {
        setError(res.error.message ?? t('impersonate_error'));
        return;
      }
      router.push(props.redirectHref);
      router.refresh();
    } catch (caughtError) {
      Sentry.captureException(caughtError, {
        tags: { authAction: 'admin.impersonate_user' },
        contexts: {
          adminImpersonation: {
            userId: props.userId,
          },
        },
      });
      setError(t('impersonate_error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {error ? (
        <span
          className="text-xs text-mit-red dark:text-mit-red-ink"
          role="alert"
        >
          {error}
        </span>
      ) : null}
      <SubmitButton
        onClick={() => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the impersonation promise.
          void onClick();
        }}
        pending={submitting}
        pendingLabel={tCommon('pending_submitting')}
        size="sm"
        type="button"
        variant="default"
      >
        {t('impersonate')}
      </SubmitButton>
    </span>
  );
}
