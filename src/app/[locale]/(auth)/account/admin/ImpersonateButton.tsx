'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/libs/auth-client';

type ImpersonateButtonProps = {
  userId: string;
  redirectHref: string;
};

// Client leaf for the server-rendered admin page: impersonation uses
// `authClient` + router and must not force the whole route to `'use client'`.
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
    <span className="inline-flex flex-wrap items-center gap-2">
      {error ? (
        <span className="text-xs text-red-700" role="alert">
          {error}
        </span>
      ) : null}
      <Button
        aria-busy={submitting}
        disabled={submitting}
        onClick={onClick}
        size="sm"
        type="button"
        variant="default"
      >
        {t('impersonate')}
      </Button>
    </span>
  );
}
