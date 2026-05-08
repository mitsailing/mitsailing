'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/libs/auth-client';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { isValidMarketingEmail } from '@/utils/emailValidation';

type ForgotPasswordFormProps = {
  callbackUrl: string;
};

// Client-side password-reset request form. Always renders the same "sent"
// banner on 2xx so the endpoint stays non-enumerating even though the
// sign-up flow exposes existence explicitly elsewhere.
export function ForgotPasswordForm(props: ForgotPasswordFormProps) {
  const t = useTranslations('ForgotPasswordPage');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    if (!isValidMarketingEmail(email)) {
      setEmailError(t('error_invalid_email'));
      return;
    }
    setSubmitting(true);
    try {
      const res = await authClient.emailOtp.requestPasswordReset({
        email,
      });
      if (res.error) {
        setEmailError(t('error_request_failed'));
        return;
      }
      setSubmitted(true);
      router.push(
        authHrefWithCallback(
          `/reset-password?email=${encodeURIComponent(email)}`,
          props.callbackUrl
        )
      );
    } catch {
      setEmailError(t('error_request_failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
        {t('sent_banner')}
      </p>
    );
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
