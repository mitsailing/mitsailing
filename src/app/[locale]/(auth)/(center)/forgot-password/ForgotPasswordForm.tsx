'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/libs/auth-client';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import {
  isValidMarketingEmail,
  normalizeMarketingEmail,
} from '@/utils/emailValidation';

type ForgotPasswordFormProps = {
  callbackUrl: string;
  initialEmail: string;
};

// Client-side password-reset request form. Mirrors the server's non-enumerating
// semantics: unknown addresses still succeed at the HTTP layer; we never
// branch UX on response `error`, which could correlate with existence if the
// plugin or transports ever diverged per email.
export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const t = useTranslations('ForgotPasswordPage');
  const router = useRouter();
  const [email, setEmail] = useState(
    normalizeMarketingEmail(props.initialEmail)
  );
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    const normalizedEmail = normalizeMarketingEmail(email);
    setEmail(normalizedEmail);
    if (!isValidMarketingEmail(normalizedEmail)) {
      setEmailError(t('error_invalid_email'));
      return;
    }
    setSubmitting(true);
    const resetHref = authHrefWithCallback(
      `/reset-password?email=${encodeURIComponent(normalizedEmail)}&codeSent=1`,
      props.callbackUrl
    );
    try {
      await authClient.emailOtp.requestPasswordReset({
        email: normalizedEmail,
      });
    } catch {
      // Keep the same client-visible result for known and unknown addresses.
    }
    router.replace(resetHref);
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      {emailError ? (
        <p
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800"
          role="alert"
        >
          {emailError}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label className="text-foreground" htmlFor="email">
          {t('email_label')}
        </Label>
        <Input
          autoComplete="email"
          id="email"
          inputMode="email"
          name="email"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
          required
          type="email"
          value={email}
        />
      </div>

      <Button
        className="w-full"
        disabled={submitting}
        type="submit"
        variant="mit"
      >
        {t('submit')}
      </Button>
    </form>
  );
}
