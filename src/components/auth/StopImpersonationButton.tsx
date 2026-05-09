'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Button
        className="h-auto min-h-0 px-0 py-0 font-semibold text-amber-900 underline shadow-none hover:bg-transparent hover:text-amber-950 hover:underline disabled:opacity-60"
        disabled={submitting}
        onClick={onClick}
        type="button"
        variant="link"
      >
        {props.label}
      </Button>
      {error ? (
        <span className="ml-2 font-medium text-red-800" role="alert">
          {props.errorLabel}
        </span>
      ) : null}
    </>
  );
}
