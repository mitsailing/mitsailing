'use client';

import { MailPlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { submitNewsletterSignupAction } from '@/libs/newsletter/newsletterActions';
import type { NewsletterSignupFormState } from '@/libs/newsletter/newsletterActions';
import { newsletterSignupFieldNames } from '@/libs/newsletter/newsletterValidation';

type NewsletterSignupFormProps = {
  locale: string;
  lists: {
    description: string | null;
    id: string;
    name: string;
    slug: string;
  }[];
};

const initialNewsletterSignupFormState: NewsletterSignupFormState = {
  ok: false,
};

function SubmitButton() {
  const t = useTranslations('NewsletterPage');
  const status = useFormStatus();
  return (
    <Button
      className="min-h-11 w-full gap-2 sm:w-auto"
      disabled={status.pending}
      type="submit"
      variant="mit"
    >
      <MailPlus aria-hidden className="size-4" />
      {status.pending ? t('signup_submit_pending') : t('signup_submit')}
    </Button>
  );
}

function emailErrorMessageKey(
  error: NonNullable<NewsletterSignupFormState['fieldErrors']>['email']
) {
  if (error === 'invalid_email') {
    return 'signup_error_email_invalid';
  }
  if (error === 'required') {
    return 'signup_error_email_required';
  }
  return 'signup_error_unknown';
}

/**
 * Public newsletter signup form.
 *
 * @param props - Form config
 * @param props.locale - Active locale
 * @param props.lists - Public newsletter lists
 * @returns Signup form
 */
export function NewsletterSignupForm(props: NewsletterSignupFormProps) {
  const t = useTranslations('NewsletterPage');
  const action = submitNewsletterSignupAction.bind(null, props.locale);
  const [state, formAction] = useActionState(
    action,
    initialNewsletterSignupFormState
  );
  const emailError = state.ok ? undefined : state.fieldErrors?.email;
  const emailErrorId = emailError ? 'newsletter-email-error' : undefined;
  const formErrorId =
    !state.ok && state.formError ? 'newsletter-signup-error' : undefined;

  return (
    <form
      action={formAction}
      aria-describedby={formErrorId}
      className="space-y-6"
      noValidate
    >
      {state.ok ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900"
          role="status"
        >
          {t('signup_success')}
        </p>
      ) : null}
      {!state.ok && state.formError ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          id="newsletter-signup-error"
          role="alert"
        >
          {state.formError === 'rate_limited'
            ? t('signup_error_rate_limited')
            : t('signup_error_unknown')}
        </p>
      ) : null}

      {state.ok ? null : (
        <>
          <div
            aria-hidden
            className="absolute top-auto left-[-10000px] h-px w-px overflow-hidden"
          >
            <Label htmlFor="newsletter-company">{t('signup_company')}</Label>
            <Input
              autoComplete="off"
              id="newsletter-company"
              name={newsletterSignupFieldNames.company}
              tabIndex={-1}
              type="text"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label className="text-foreground" htmlFor="newsletter-name">
                {t('signup_name')}
              </Label>
              <Input
                autoComplete="name"
                className="min-h-11 bg-background"
                id="newsletter-name"
                name={newsletterSignupFieldNames.name}
                type="text"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-foreground" htmlFor="newsletter-email">
                {t('signup_email')}
              </Label>
              <Input
                autoComplete="email"
                aria-describedby={emailErrorId}
                aria-invalid={emailError ? true : undefined}
                className="min-h-11 bg-background"
                id="newsletter-email"
                inputMode="email"
                name={newsletterSignupFieldNames.email}
                required
                type="email"
              />
              {emailError ? (
                <p
                  className="text-sm text-destructive"
                  id="newsletter-email-error"
                  role="alert"
                >
                  {t(emailErrorMessageKey(emailError))}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-foreground">
              {t('lists_label')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {props.lists.map((list) => (
                <label
                  className="rounded-lg border border-border bg-card p-4 text-sm"
                  key={list.id}
                >
                  <span className="flex items-start gap-3">
                    <input
                      className="mt-1"
                      defaultChecked={list.slug === 'general'}
                      disabled={list.slug === 'general'}
                      name={newsletterSignupFieldNames.list}
                      type="checkbox"
                      value={list.slug}
                    />
                    {list.slug === 'general' ? (
                      <input
                        name={newsletterSignupFieldNames.list}
                        type="hidden"
                        value={list.slug}
                      />
                    ) : null}
                    <span>
                      <span className="block font-medium text-foreground">
                        {list.name}
                      </span>
                      {list.description ? (
                        <span className="mt-1 block text-muted-foreground">
                          {list.description}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 text-sm leading-relaxed text-mit-text">
              {t('signup_privacy')}
            </p>
            <SubmitButton />
          </div>
        </>
      )}
    </form>
  );
}
