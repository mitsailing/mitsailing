'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/libs/auth-client';
import { getI18nPath } from '@/utils/Helpers';

type SignOutFormProps = {
  locale: string;
  label: string;
};

// Client-side sign-out button wired to `authClient.signOut`. Uses `router.push`
// so the post-sign-out redirect respects locale-aware paths.
export function SignOutForm(props: SignOutFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    setSubmitting(true);
    await authClient.signOut();
    router.push(getI18nPath('/sign-in', props.locale));
    router.refresh();
  }

  return (
    <button
      className="border-none text-gray-700 hover:text-gray-900 disabled:opacity-60"
      disabled={submitting}
      onClick={onClick}
      type="button"
    >
      {props.label}
    </button>
  );
}
