'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SubmitButton } from '@/components/ui/submit-button';
import { authInlineLinkClassName } from '@/lib/mit-sailing/tokens';
import { authClient } from '@/libs/auth-client';
import { authClientThrownMessage } from '@/libs/auth/authClientThrownMessage';
import { authHrefWithCallback } from '@/libs/auth/callbackUrl';
import { reportUnknownAuthClientError } from '@/libs/auth/reportAuthClientError';
import { Link as I18nLink } from '@/libs/I18nNavigation';
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from '@/utils/emailValidation';

type ErrorState = {
  message: string;
  showSignInLinks: boolean;
} | null;

type SignUpFormProps = {
  callbackUrl: string;
  initialEmail?: string;
};

type SignUpFormValues = {
  email: string;
  password: string;
  passwordConfirmation: string;
};

type SignUpFieldErrorKey =
  | 'error_invalid_email'
  | 'error_password_mismatch'
  | 'error_password_too_short'
  | 'error_required';

const fieldErrorId = (field: keyof SignUpFormValues) =>
  `sign-up-${field}-error`;

const isSignUpFieldErrorKey = (value: unknown): value is SignUpFieldErrorKey =>
  value === 'error_invalid_email' ||
  value === 'error_password_mismatch' ||
  value === 'error_password_too_short' ||
  value === 'error_required';

// Client-side sign-up form. Calls `authClient.signUp.email` and maps the
// explicit `EMAIL_EXISTS` and `PASSWORD_COMPROMISED` codes (both surfaced by
// our hooks + HaveIBeenPwned plugin) to copy that keeps the Devise-style UX.
export function SignUpForm(props: SignUpFormProps) {
  const t = useTranslations('SignUpPage');
  const tCommon = useTranslations('Common');
  const router = useRouter();
  const [formError, setFormError] = useState<ErrorState>(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    formState: { errors },
    getValues,
    handleSubmit,
    register,
    setValue,
  } = useForm<SignUpFormValues>({
    defaultValues: {
      email: normalizeEmailAddress(props.initialEmail ?? ''),
      password: '',
      passwordConfirmation: '',
    },
    mode: 'onTouched',
    reValidateMode: 'onChange',
  });

  function mapError(
    code: string | undefined,
    message: string | undefined
  ): ErrorState {
    // Better Auth may surface a code, a message, or both; hooks sometimes send
    // a semantic string in `message` when `code` is absent.
    if (code === 'EMAIL_EXISTS' || message === 'EMAIL_EXISTS') {
      return { message: t('error_exists'), showSignInLinks: true };
    }
    if (code === 'PASSWORD_COMPROMISED' || message === 'PASSWORD_COMPROMISED') {
      return { message: t('error_pwned'), showSignInLinks: false };
    }
    if (code === 'TOO_MANY_REQUESTS' || message === 'TOO_MANY_REQUESTS') {
      return { message: t('error_rate_limited'), showSignInLinks: false };
    }
    reportUnknownAuthClientError({
      action: 'signup.email',
      code,
      message,
    });
    return {
      message: t('error_generic'),
      showSignInLinks: false,
    };
  }

  const fieldMessage = (value: unknown) =>
    isSignUpFieldErrorKey(value) ? t(value) : null;

  async function onValidSubmit(values: SignUpFormValues) {
    setFormError(null);
    const normalizedEmail = normalizeEmailAddress(values.email);
    setValue('email', normalizedEmail, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setSubmitting(true);
    const displayName = normalizedEmail.slice(0, normalizedEmail.indexOf('@'));
    let keepSubmitting = false;
    try {
      const res = await authClient.signUp.email({
        email: normalizedEmail,
        password: values.password,
        name: displayName,
        callbackURL: props.callbackUrl,
      });
      if (res.error) {
        setFormError(mapError(res.error.code, res.error.message));
        return;
      }
      setSubmitted(true);
      keepSubmitting = true;
      router.push(
        authHrefWithCallback(
          `/verify-email?email=${encodeURIComponent(normalizedEmail)}&codeSent=1`,
          props.callbackUrl
        )
      );
    } catch (caughtError) {
      reportUnknownAuthClientError({
        action: 'signup.email.thrown',
        code: undefined,
        message: authClientThrownMessage(caughtError),
      });
      setFormError({
        message: t('error_generic'),
        showSignInLinks: false,
      });
    } finally {
      if (!keepSubmitting) {
        setSubmitting(false);
      }
    }
  }

  return (
    <>
      {submitted ? (
        <p
          aria-live="polite"
          className="rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-medium text-green-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:bg-green-950/30 dark:text-green-100"
          role="status"
        >
          {t('registered_banner')}
        </p>
      ) : null}
      {formError ? (
        <p
          className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100"
          role="alert"
        >
          {formError.message}
          {formError.showSignInLinks ? (
            <>
              {' '}
              <I18nLink
                className={authInlineLinkClassName}
                href={authHrefWithCallback('/login', props.callbackUrl)}
              >
                {t('sign_in_link')}
              </I18nLink>
              {' · '}
              <I18nLink
                className={authInlineLinkClassName}
                href={authHrefWithCallback(
                  '/forgot-password',
                  props.callbackUrl
                )}
              >
                {t('forgot_password_link')}
              </I18nLink>
            </>
          ) : null}
        </p>
      ) : null}

      <form
        className="flex flex-col gap-4"
        noValidate
        onSubmit={handleSubmit((values) => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the form promise.
          void onValidSubmit(values);
        })}
      >
        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="email">
            {t('email_label')}
          </Label>
          <Input
            aria-describedby={errors.email ? fieldErrorId('email') : undefined}
            aria-invalid={errors.email ? true : undefined}
            autoComplete="email"
            id="email"
            required
            type="email"
            {...register('email', {
              required: 'error_required',
              validate: (value) =>
                isValidEmailAddress(normalizeEmailAddress(value)) ||
                'error_invalid_email',
            })}
          />
          {errors.email?.message ? (
            <p
              className="text-sm font-medium text-red-900 dark:text-red-100"
              id={fieldErrorId('email')}
              role="alert"
            >
              {fieldMessage(errors.email.message)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="password">
            {t('password_label')}
          </Label>
          <Input
            aria-describedby={
              [
                'sign-up-password-hint',
                errors.password ? fieldErrorId('password') : undefined,
              ]
                .filter((id) => id !== undefined)
                .join(' ') || undefined
            }
            aria-invalid={errors.password ? true : undefined}
            autoComplete="new-password"
            id="password"
            required
            type="password"
            {...register('password', {
              required: 'error_required',
              minLength: {
                value: 8,
                message: 'error_password_too_short',
              },
            })}
          />
          <span
            className="text-xs text-muted-foreground"
            id="sign-up-password-hint"
          >
            {t('password_hint')}
          </span>
          {errors.password?.message ? (
            <p
              className="text-sm font-medium text-red-900 dark:text-red-100"
              id={fieldErrorId('password')}
              role="alert"
            >
              {fieldMessage(errors.password.message)}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label className="text-foreground" htmlFor="passwordConfirmation">
            {t('password_confirmation_label')}
          </Label>
          <Input
            aria-describedby={
              errors.passwordConfirmation
                ? fieldErrorId('passwordConfirmation')
                : undefined
            }
            aria-invalid={errors.passwordConfirmation ? true : undefined}
            autoComplete="new-password"
            id="passwordConfirmation"
            required
            type="password"
            {...register('passwordConfirmation', {
              required: 'error_required',
              validate: (value) =>
                value === getValues('password') || 'error_password_mismatch',
            })}
          />
          {errors.passwordConfirmation?.message ? (
            <p
              className="text-sm font-medium text-red-900 dark:text-red-100"
              id={fieldErrorId('passwordConfirmation')}
              role="alert"
            >
              {fieldMessage(errors.passwordConfirmation.message)}
            </p>
          ) : null}
        </div>

        <SubmitButton
          className="min-h-11 w-full"
          pending={submitting}
          pendingLabel={tCommon('pending_submitting')}
          variant="mit"
        >
          {t('submit')}
        </SubmitButton>
      </form>
    </>
  );
}
