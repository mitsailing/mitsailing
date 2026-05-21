'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import { getI18nPath } from '@/utils/Helpers';

type StopImpersonationButtonProps = {
  errorLabel: string;
  locale: string;
  label: string;
};

// Ends the current impersonation session so the admin returns to their own
// identity. `authClient.admin.stopImpersonating` clears the impersonated
// session cookie and restores the admin's original session.
export function StopImpersonationButton(props: StopImpersonationButtonProps) {
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setError(false);
    setSubmitting(true);
    try {
      await authClient.admin.stopImpersonating();
      router.push(getI18nPath('/admin/users', props.locale));
      router.refresh();
    } catch (caughtError) {
      console.error(
        'StopImpersonationButton stop impersonation failed.',
        caughtError
      );
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <SubmitButton
        className="h-auto min-h-0 px-0 py-0 font-semibold text-foreground underline shadow-none hover:bg-transparent hover:text-mit-red-hover hover:underline disabled:opacity-60"
        onClick={() => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the stop promise.
          void onClick();
        }}
        pending={submitting}
        pendingLabel={tCommon('pending_submitting')}
        type="button"
        variant="link"
      >
        {props.label}
      </SubmitButton>
      {error ? (
        <span className="ml-2 font-medium text-red-800" role="alert">
          {props.errorLabel}
        </span>
      ) : null}
    </>
  );
}
