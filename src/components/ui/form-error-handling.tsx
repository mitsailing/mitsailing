'use client';

import * as Sentry from '@sentry/nextjs';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { cn } from '@/lib/utils';
import {
  collectInvalidFormControls,
  focusFormControl,
} from '@/libs/forms/formValidationSummary';
import type { FormValidationSummaryEntry } from '@/libs/forms/formValidationSummary';

/** Warn when a submit stays pending longer than users will realistically wait. */
const DEFAULT_SUBMIT_TIMEOUT_MS = 5000;

export type FormErrorHandlingProps = {
  additionalErrors?: readonly FormValidationSummaryEntry[];
  formId: string;
  serverFieldErrors?: readonly FormValidationSummaryEntry[];
  submitTimeoutMs?: number;
  summaryTitle: string;
  timeoutMessage: string;
};

function mergeSummaryEntries(
  ...groups: readonly (readonly FormValidationSummaryEntry[] | undefined)[]
): FormValidationSummaryEntry[] {
  const seen = new Set<string>();
  const merged: FormValidationSummaryEntry[] = [];

  for (const group of groups) {
    if (!group) {
      continue;
    }
    for (const entry of group) {
      if (seen.has(entry.controlId)) {
        continue;
      }
      seen.add(entry.controlId);
      merged.push(entry);
    }
  }

  return merged;
}

/**
 * Renders an accessible validation summary and watches the parent form for
 * native validation failures and long-running Server Action submits.
 *
 * @param props - Summary copy, optional server/additional errors, and form id
 * @returns Error summary live region or null when there are no errors
 */
export function FormErrorHandling(props: FormErrorHandlingProps) {
  const formStatus = useFormStatus();
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const [validationErrors, setValidationErrors] = React.useState<
    FormValidationSummaryEntry[]
  >([]);
  const [submitTimedOut, setSubmitTimedOut] = React.useState(false);

  const items = mergeSummaryEntries(
    props.serverFieldErrors,
    props.additionalErrors,
    validationErrors,
    submitTimedOut
      ? [
          {
            controlId: `${props.formId}-submit-timeout`,
            label: props.summaryTitle,
            message: props.timeoutMessage,
          },
        ]
      : undefined
  );

  React.useEffect(() => {
    const form = summaryRef.current?.closest('form');
    if (!form) {
      return;
    }

    function onInvalid(event: Event) {
      event.preventDefault();
      const { target } = event;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const targetForm = target.closest('form');
      if (!(targetForm instanceof HTMLFormElement)) {
        return;
      }
      const nextErrors = collectInvalidFormControls(targetForm);
      setValidationErrors(nextErrors);
      setSubmitTimedOut(false);
      queueMicrotask(() => {
        summaryRef.current?.focus();
      });
    }

    function onSubmit() {
      setValidationErrors([]);
      setSubmitTimedOut(false);
    }

    form.addEventListener('invalid', onInvalid, true);
    form.addEventListener('submit', onSubmit);
    return () => {
      form.removeEventListener('invalid', onInvalid, true);
      form.removeEventListener('submit', onSubmit);
    };
  }, []);

  React.useEffect(() => {
    if (!props.serverFieldErrors?.length && !props.additionalErrors?.length) {
      return;
    }
    queueMicrotask(() => {
      summaryRef.current?.focus();
    });
  }, [props.additionalErrors, props.serverFieldErrors]);

  React.useEffect(() => {
    if (!formStatus.pending) {
      setSubmitTimedOut(false);
      return;
    }

    const timer = globalThis.setTimeout(() => {
      setSubmitTimedOut(true);
      Sentry.captureMessage('Form submit timeout', {
        level: 'warning',
        tags: { formId: props.formId },
      });
      queueMicrotask(() => {
        summaryRef.current?.focus();
      });
    }, props.submitTimeoutMs ?? DEFAULT_SUBMIT_TIMEOUT_MS);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [formStatus.pending, props.formId, props.submitTimeoutMs]);

  if (items.length === 0) {
    return <div aria-hidden className="hidden" ref={summaryRef} />;
  }

  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      aria-relevant="all"
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/20',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring'
      )}
      data-slot="form-error-summary"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <p className="font-medium">{props.summaryTitle}</p>
      <ul className="list-disc space-y-1 pl-5">
        {items.map((entry) => (
          <li key={entry.controlId}>
            <button
              className="text-left underline underline-offset-2"
              onClick={() => {
                const form = summaryRef.current?.closest('form');
                if (form instanceof HTMLFormElement) {
                  focusFormControl(form, entry.controlId);
                }
              }}
              type="button"
            >
              {entry.label}: {entry.message}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
