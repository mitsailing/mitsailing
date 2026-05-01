'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';
import { authClient } from '@/libs/auth-client';

/**
 * Keeps Sentry `user` context in sync with the Better Auth client session so
 * browser errors include `id` and `email` when available.
 *
 * @returns Null; this component exists only for side effects.
 */
export function SentryUserSync() {
  const { data, isPending } = authClient.useSession();

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DISABLED) {
      return;
    }
    if (isPending) {
      return;
    }
    const user = data?.user;
    const id = user && typeof user.id === 'string' ? user.id : undefined;
    if (!id) {
      Sentry.setUser(null);
      return;
    }
    const email =
      user && typeof user.email === 'string' ? user.email : undefined;
    Sentry.setUser({ id, email });
  }, [data, isPending]);

  return null;
}
