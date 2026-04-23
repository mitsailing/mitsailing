'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/libs/auth-client';

type ImpersonateButtonProps = {
  userId: string;
  redirectHref: string;
};

// Starts an admin-plugin impersonation session for the given user id. The
// server issues a `Set-Cookie` on success, so we refresh the route after the
// call to pick up the new session.
export function ImpersonateButton(props: ImpersonateButtonProps) {
  const t = useTranslations('AdminPage');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setError(null);
    setSubmitting(true);
    const res = await authClient.admin.impersonateUser({
      userId: props.userId,
    });
    setSubmitting(false);
    if (res.error) {
      setError(res.error.message ?? t('impersonate_error'));
      return;
    }
    router.push(props.redirectHref);
    router.refresh();
  }

  return (
    <>
      {error ? (
        <span className="mr-2 text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
      <button
        className="rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
        disabled={submitting}
        onClick={onClick}
        type="button"
      >
        {t('impersonate')}
      </button>
    </>
  );
}
