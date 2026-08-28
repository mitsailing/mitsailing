'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authClient } from '@/libs/auth-client';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
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
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [email, setEmail] = useState(normalizeEmailAddress(props.initialEmail));
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    const normalizedEmail = normalizeEmailAddress(email);
    setEmail(normalizedEmail);
    if (!isValidEmailAddress(normalizedEmail)) {
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
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'forgot-password.request-reset.thrown',
        code: undefined,
        message:
          caughtError instanceof Error && caughtError.message.trim() !== ''
            ? caughtError.message.trim()
            : undefined,
      });
      // Keep the same client-visible result for known and unknown addresses.
    } finally {
      router.replace(resetHref);
      setSubmitting(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
        void onSubmit(event);
      }}
    >
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

      <SubmitButton
        className="w-full"
        pending={submitting}
        pendingLabel={tCommon('pending_sending')}
        variant="mit"
      >
        {t('submit')}
      </SubmitButton>
    </form>
  );
}
