'use client';

import { Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { submitContactSubmissionAction } from '@/libs/mit-sailing/contactSubmissionActions';
import type { ContactSubmissionFormState } from '@/libs/mit-sailing/contactSubmissionActions';
import { contactSubmissionFieldNames } from '@/libs/mit-sailing/contactSubmissionValidation';
import type {
  ContactSubmissionField,
  ContactSubmissionFieldError,
} from '@/libs/mit-sailing/contactSubmissionValidation';

type ContactFormProps = {
  locale: string;
};

type ContactClientT = ReturnType<typeof useTranslations>;

const initialContactSubmissionFormState: ContactSubmissionFormState = {
  ok: false,
};

function fieldErrorMessage(
  field: ContactSubmissionField,
  error: ContactSubmissionFieldError,
  t: ContactClientT
): string {
  if (field === 'name') {
    return error === 'too_long'
      ? t('form_error_name_long')
      : t('form_error_name_required');
  }
  if (field === 'email') {
    if (error === 'invalid_email') {
      return t('form_error_email_invalid');
    }
    return error === 'too_long'
      ? t('form_error_email_long')
      : t('form_error_email_required');
  }
  if (error === 'too_short') {
    return t('form_error_message_short');
  }
  return error === 'too_long'
    ? t('form_error_message_long')
    : t('form_error_message_required');
}

function FieldError(props: {
  field: ContactSubmissionField;
  id: string;
  state: ContactSubmissionFormState;
}) {
  const t = useTranslations('MitSailingContact');
  if (props.state.ok) {
    return null;
  }
  const error = props.state.fieldErrors?.[props.field];
  if (!error) {
    return null;
  }
  return (
    <p className="mt-1.5 text-sm text-destructive" id={props.id} role="alert">
      {fieldErrorMessage(props.field, error, t)}
    </p>
  );
}

function SubmitButton() {
  const t = useTranslations('MitSailingContact');
  const status = useFormStatus();
  return (
    <Button
      className="min-h-11 w-full gap-2 sm:w-auto"
      disabled={status.pending}
      type="submit"
      variant="mit"
    >
      <Send aria-hidden className="size-4" />
      {status.pending ? t('form_submit_pending') : t('form_submit')}
    </Button>
  );
}

/**
 * Public contact form with Server Action submission and inline status.
 *
 * @param props - Client form configuration
 * @param props.locale - Active locale for server action redirects and admin links
 * @returns Contact form controls
 */
export function ContactForm(props: ContactFormProps) {
  const t = useTranslations('MitSailingContact');
  const action = submitContactSubmissionAction.bind(null, props.locale);
  const [state, formAction] = useActionState(
    action,
    initialContactSubmissionFormState
  );
  const nameError = state.ok ? undefined : state.fieldErrors?.name;
  const emailError = state.ok ? undefined : state.fieldErrors?.email;
  const messageError = state.ok ? undefined : state.fieldErrors?.message;

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {state.ok ? (
        <p
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-900"
          role="status"
        >
          {t('form_success')}
        </p>
      ) : null}
      {!state.ok && state.formError ? (
        <p
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive"
          role="alert"
        >
          {state.formError === 'rate_limited'
            ? t('form_error_rate_limited')
            : t('form_error_unknown')}
        </p>
      ) : null}

      <div className="sr-only">
        <Label htmlFor="contact-company">{t('form_company')}</Label>
        <Input
          autoComplete="off"
          id="contact-company"
          name={contactSubmissionFieldNames.company}
          tabIndex={-1}
          type="text"
        />
      </div>

      <div>
        <Label className="mb-2 text-foreground" htmlFor="contact-name">
          {t('form_name')}
        </Label>
        <Input
          autoComplete="name"
          aria-describedby={nameError ? 'contact-name-error' : undefined}
          aria-invalid={nameError ? true : undefined}
          className="min-h-11 bg-background"
          id="contact-name"
          name={contactSubmissionFieldNames.name}
          placeholder={t('form_name_placeholder')}
          required
          type="text"
        />
        <FieldError field="name" id="contact-name-error" state={state} />
      </div>

      <div>
        <Label className="mb-2 text-foreground" htmlFor="contact-email">
          {t('form_email')}
        </Label>
        <Input
          autoComplete="email"
          aria-describedby={emailError ? 'contact-email-error' : undefined}
          aria-invalid={emailError ? true : undefined}
          className="min-h-11 bg-background"
          id="contact-email"
          inputMode="email"
          name={contactSubmissionFieldNames.email}
          placeholder={t('form_email_placeholder')}
          required
          type="email"
        />
        <FieldError field="email" id="contact-email-error" state={state} />
      </div>

      <div>
        <Label className="mb-2 text-foreground" htmlFor="contact-message">
          {t('form_message')}
        </Label>
        <Textarea
          aria-describedby={messageError ? 'contact-message-error' : undefined}
          aria-invalid={messageError ? true : undefined}
          className="min-h-40 resize-y bg-background"
          id="contact-message"
          name={contactSubmissionFieldNames.message}
          placeholder={t('form_message_placeholder')}
          required
        />
        <FieldError field="message" id="contact-message-error" state={state} />
      </div>

      <div className="flex flex-col-reverse gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="m-0 text-sm leading-relaxed text-mit-text">
          {t('form_privacy')}
        </p>
        <SubmitButton />
      </div>
    </form>
  );
}
