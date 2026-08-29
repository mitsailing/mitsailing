'use client';

import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { getI18nPath } from '@/utils/Helpers';

type SignOutFormProps = {
  locale: string;
  label: string;
  /** App path after sign out (default `/login`). */
  redirectPath?: string;
  /** Overrides default gray account-nav styling when used in headers, etc. */
  buttonClassName?: string;
  /** Runs before sign-out work (e.g. close the mobile nav drawer). */
  onSignOutStart?: () => void;
};

// Client-side sign-out button wired to `authClient.signOut`. Uses `router.push`
// so the post-sign-out redirect respects locale-aware paths.
export function SignOutForm(props: SignOutFormProps) {
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    props.onSignOutStart?.();
    setSubmitting(true);
    try {
      const res = await authClient.signOut();
      if (res.error) {
        reportUnknownAuthClientError({
          action: 'sign_out',
          code: res.error.code,
          message: res.error.message,
        });
        setSubmitting(false);
        return;
      }
      router.push(getI18nPath(props.redirectPath ?? '/login', props.locale));
      router.refresh();
    } catch (caughtError) {
      Sentry.captureException(caughtError, {
        tags: { authAction: 'sign_out' },
      });
      setSubmitting(false);
    }
  }

  return (
    <SubmitButton
      className={
        props.buttonClassName ??
        'h-auto min-h-0 rounded-md border-none bg-transparent px-0 py-0 font-normal text-gray-700 shadow-none hover:bg-transparent hover:text-gray-900 disabled:opacity-60'
      }
      onClick={() => {
        // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the sign-out promise.
        void onClick();
      }}
      pending={submitting}
      pendingLabel={tCommon('pending_submitting')}
      type="button"
      variant="ghost"
    >
      {props.label}
    </SubmitButton>
  );
}
