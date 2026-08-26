'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';
import { AdminErrorAlert } from '@/components/mit-sailing/admin/AdminErrorAlert';
import { FormErrorHandling } from '@/components/ui/form-error-handling';
import { FormSubmitTimeoutContext } from '@/components/ui/form-submit-timeout-context';
import { cn } from '@/lib/utils';
import type { FormValidationSummaryEntry } from '@/libs/forms/formValidationSummary';

export type ActionFormProps = {
  action: string | ((formData: FormData) => void | Promise<void>);
  additionalErrors?: readonly FormValidationSummaryEntry[];
  autoComplete?: string;
  children: React.ReactNode;
  className?: string;
  formError?: string | null;
  formId: string;
  onSubmit?: (event: React.SubmitEvent<HTMLFormElement>) => void;
  serverFieldErrors?: readonly FormValidationSummaryEntry[];
};

/**
 * Standard server-action form: wires validation summary, submit timeout, and
 * optional form-level server error. Pair with {@link SubmitButton} in
 * {@link FormActions}.
 *
 * @param props - Form action, id, errors, and field content
 * @returns Form element with unified error handling
 */
export function ActionForm(props: ActionFormProps) {
  const tCommon = useTranslations('Common');
  const [submitTimedOut, setSubmitTimedOut] = React.useState(false);

  return (
    <FormSubmitTimeoutContext.Provider value={submitTimedOut}>
      <form
        action={props.action}
        autoComplete={props.autoComplete}
        className={props.className}
        onSubmit={props.onSubmit}
      >
        <FormErrorHandling
          additionalErrors={props.additionalErrors}
          formId={props.formId}
          onSubmitTimedOutChange={setSubmitTimedOut}
          serverFieldErrors={props.serverFieldErrors}
          summaryTitle={tCommon('form_error_summary_title')}
          timeoutMessage={tCommon('form_error_submit_timeout')}
        />
        {props.formError ? (
          <AdminErrorAlert className="mb-4">{props.formError}</AdminErrorAlert>
        ) : null}
        {props.children}
      </form>
    </FormSubmitTimeoutContext.Provider>
  );
}

type FormActionsProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Shared footer row for form primary and secondary submit buttons.
 *
 * @param props - Action buttons (normally {@link SubmitButton} children)
 * @returns Flex row for submit controls
 */
export function FormActions(props: FormActionsProps) {
  return (
    <div className={cn('flex flex-wrap gap-3 pt-2', props.className)}>
      {props.children}
    </div>
  );
}
