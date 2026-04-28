'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/libs/auth-client';
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
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    props.onSignOutStart?.();
    setSubmitting(true);
    try {
      await authClient.signOut();
      router.push(getI18nPath(props.redirectPath ?? '/login', props.locale));
      router.refresh();
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <Button
      aria-busy={submitting}
      className={
        props.buttonClassName ??
        'h-auto min-h-0 rounded-md border-none bg-transparent px-0 py-0 font-normal text-gray-700 shadow-none hover:bg-transparent hover:text-gray-900 disabled:opacity-60'
      }
      disabled={submitting}
      onClick={onClick}
      type="button"
      variant="ghost"
    >
      {props.label}
    </Button>
  );
}
