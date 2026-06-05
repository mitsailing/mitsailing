import * as React from 'react';
import { cn } from '@/lib/utils';

/** Shared surface classes for inline admin error messages after server actions. */
const adminAlertErrorClasses =
  'rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive dark:bg-destructive/20';

/** Shared surface classes for inline admin success messages after server actions. */
const adminAlertSuccessClasses =
  'rounded-lg border border-mit-success/30 bg-mit-success/10 px-3 py-2 text-sm font-medium text-mit-success-ink';

/**
 * Native `p` attributes; live-region props are fixed per MDN guidance (`role="alert"` plus explicit
 * `aria-live` for assistive-tech compatibility).
 */
export type AdminErrorAlertProps = Omit<
  React.ComponentPropsWithoutRef<'p'>,
  'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant'
>;

export type AdminSuccessAlertProps = Omit<
  React.ComponentPropsWithoutRef<'output'>,
  'role' | 'aria-live' | 'aria-atomic' | 'aria-relevant'
>;

/**
 * Paragraph with assertive alert semantics and the shared destructive admin surface.
 * Sets `aria-live="assertive"`, `aria-atomic="true"`, and `aria-relevant="all"` alongside `role="alert"`
 * so screen readers treat server-action errors as immediate, full announcements (MDN live regions).
 *
 * @param props - `children`, optional `className`, and other `p` attributes
 * @returns Styled alert paragraph
 */
export function AdminErrorAlert(props: AdminErrorAlertProps) {
  return (
    <p
      {...props}
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      aria-relevant="all"
      className={cn(adminAlertErrorClasses, props.className)}
    />
  );
}

export function AdminSuccessAlert(props: AdminSuccessAlertProps) {
  return (
    <output
      {...props}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-relevant="all"
      className={cn(adminAlertSuccessClasses, props.className)}
    />
  );
}
