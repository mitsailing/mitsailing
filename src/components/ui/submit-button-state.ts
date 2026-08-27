import type * as React from 'react';
import type { useFormStatus } from 'react-dom';
import type { Button } from '@/components/ui/button';

/**
 * Pending helpers live outside `submit-button.tsx` because Lizard measures a
 * TSX file as a single span, so JSX and branching logic cannot share a file
 * without exceeding the complexity gate.
 */

const pendingKindKeys = {
  adding: 'pending_adding',
  deleting: 'pending_deleting',
  saving: 'pending_saving',
  sending: 'pending_sending',
  submitting: 'pending_submitting',
} as const;

export type SubmitPendingKind = keyof typeof pendingKindKeys;

export type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean;
} & (
    | { pendingLabel: string; pendingKind?: never }
    | { pendingKind: SubmitPendingKind; pendingLabel?: string }
  );

type FormStatus = ReturnType<typeof useFormStatus>;

/**
 * Separates the pending-only props from the props the DOM button accepts.
 *
 * @param props - Submit button props including the pending-only fields
 * @returns Props to spread onto the underlying button
 */
export function buttonPassthroughProps(props: SubmitButtonProps) {
  const buttonProps: React.ComponentProps<typeof Button> & {
    pending?: boolean;
    pendingKind?: SubmitPendingKind;
    pendingLabel?: string;
  } = { ...props };
  delete buttonProps.pending;
  delete buttonProps.pendingKind;
  delete buttonProps.pendingLabel;
  return buttonProps;
}

/**
 * Resolves whether this control's own submit is the one in flight.
 *
 * @param options - Explicit pending flag, form status, and optional form action
 * @returns Whether to render pending chrome
 */
export function resolveIsPending(options: {
  formAction: SubmitButtonProps['formAction'];
  formStatus: FormStatus;
  pending: boolean | undefined;
}): boolean {
  if (options.pending !== undefined) {
    return options.pending;
  }
  if (!options.formStatus.pending) {
    return false;
  }
  return (
    options.formAction === undefined ||
    options.formStatus.action === options.formAction
  );
}

/**
 * Resolves pending text from an explicit label or a Common message key.
 *
 * @param options - Label inputs and the Common translator
 * @returns Pending label text
 */
export function resolvePendingLabel(options: {
  pendingKind: SubmitPendingKind | undefined;
  pendingLabel: string | undefined;
  translate: (key: (typeof pendingKindKeys)[SubmitPendingKind]) => string;
}): string {
  if (options.pendingLabel !== undefined) {
    return options.pendingLabel;
  }
  if (options.pendingKind === undefined) {
    return '';
  }
  return options.translate(pendingKindKeys[options.pendingKind]);
}

/**
 * Adds the pending announcement to the caller's own `aria-describedby`.
 *
 * @param options - Caller description ids, pending state, and announcement id
 * @returns Description id list, or undefined when there is nothing to describe
 */
function resolveDescribedBy(options: {
  ariaDescribedBy: string | undefined;
  isPending: boolean;
  pendingDescriptionId: string;
}): string | undefined {
  if (!options.isPending) {
    return options.ariaDescribedBy;
  }
  if (options.ariaDescribedBy === undefined) {
    return options.pendingDescriptionId;
  }
  return `${options.ariaDescribedBy} ${options.pendingDescriptionId}`;
}

/**
 * Builds the accessibility and disabled chrome for the current pending state.
 *
 * @param options - Resolved pending state plus the caller's own button chrome
 * @returns Props to apply after the caller's passthrough props
 */
export function submitButtonChrome(options: {
  ariaDescribedBy: string | undefined;
  disabled: SubmitButtonProps['disabled'];
  isPending: boolean;
  pendingDescriptionId: string;
  pendingLabel: string;
  title: SubmitButtonProps['title'];
  type: SubmitButtonProps['type'];
}) {
  return {
    'aria-busy': options.isPending || undefined,
    'aria-describedby': resolveDescribedBy({
      ariaDescribedBy: options.ariaDescribedBy,
      isPending: options.isPending,
      pendingDescriptionId: options.pendingDescriptionId,
    }),
    disabled: options.isPending || options.disabled,
    title: options.isPending ? options.pendingLabel : options.title,
    type: options.type ?? 'submit',
  };
}
