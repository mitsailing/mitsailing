'use client';

import { useTranslations } from 'next-intl';
import * as React from 'react';

export type FormValidationSummaryEntry = {
  controlId: string;
  label: string;
  message: string;
};

export type FormErrorSummaryProps = {
  entries: readonly FormValidationSummaryEntry[];
};

/**
 * Accessible list of the field errors a form already knows about.
 *
 * Entries come from `react-hook-form` state or server-returned field errors;
 * this component never inspects the DOM for validity.
 *
 * @param props - Summary entries, in the order they should be announced
 * @returns Live region listing each error, or null when there are none
 */
export function FormErrorSummary(props: FormErrorSummaryProps) {
  const tCommon = useTranslations('Common');
  const summaryRef = React.useRef<HTMLDivElement>(null);
  const seenControlIds = new Set<string>();
  const entries = props.entries.filter((entry) => {
    if (seenControlIds.has(entry.controlId)) {
      return false;
    }
    seenControlIds.add(entry.controlId);
    return true;
  });
  const entryKey = entries.map((entry) => entry.controlId).join('|');

  React.useEffect(() => {
    if (entryKey) {
      summaryRef.current?.focus();
    }
  }, [entryKey]);

  if (entries.length === 0) {
    return null;
  }

  return (
    <div
      aria-atomic="true"
      aria-live="assertive"
      className="flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-destructive/20"
      data-slot="form-error-summary"
      ref={summaryRef}
      role="alert"
      tabIndex={-1}
    >
      <p className="font-medium">{tCommon('form_error_summary_title')}</p>
      <ul className="list-disc space-y-1 pl-5">
        {entries.map((entry) => (
          <li key={entry.controlId}>
            <a
              className="underline underline-offset-2"
              href={`#${entry.controlId}`}
            >
              {entry.label}: {entry.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
