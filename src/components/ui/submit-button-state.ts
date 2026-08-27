import type * as React from 'react';
import type { Button } from '@/components/ui/button';

export const pendingKindKeys = {
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

type FormStatusAction =
  | string
  | ((formData: FormData) => void | Promise<void>)
  | null;

/**
 * Resolves whether the submit control should show pending UI.
 *
 * Explicit `pending` wins. Otherwise the nearest form must be pending, the
 * form must not have timed out, and optional `formAction` must match the
 * action currently in flight.
 *
 * @param options - Pending inputs from props and form status
 * @returns Whether the button should render as pending
 */
export function isSubmitButtonPending(options: {
  formAction: SubmitButtonProps['formAction'];
  formPending: boolean;
  formStatusAction: FormStatusAction;
  pendingProp: boolean | undefined;
  submitTimedOut: boolean;
}): boolean {
  if (options.pendingProp !== undefined) {
    return options.pendingProp;
  }
  if (!options.formPending) {
    return false;
  }
  if (options.submitTimedOut) {
    return false;
  }
  if (options.formAction === undefined) {
    return true;
  }
  return options.formStatusAction === options.formAction;
}

/**
 * Resolves the visible pending label from an explicit string or kind key.
 *
 * @param options - Pending label inputs and translator
 * @returns Pending label text
 */
export function resolveSubmitPendingLabel(options: {
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
 * Strips SubmitButton-only props before forwarding the rest to {@link Button}.
 *
 * @param props - Full submit button props
 * @returns Props safe to spread onto Button
 */
export function submitButtonPassthroughProps(
  props: SubmitButtonProps
): React.ComponentProps<typeof Button> {
  const buttonProps = { ...props } as Record<string, unknown>;
  delete buttonProps.children;
  delete buttonProps.pending;
  delete buttonProps.pendingKind;
  delete buttonProps.pendingLabel;
  return buttonProps as React.ComponentProps<typeof Button>;
}

/**
 * Joins optional aria-describedby ids into a single attribute value.
 *
 * @param ids - Candidate description ids
 * @returns Space-joined ids, or undefined when empty
 */
export function joinDescribedByIds(
  ...ids: (string | undefined)[]
): string | undefined {
  const describedBy = ids.filter(Boolean).join(' ');
  if (describedBy.length === 0) {
    return undefined;
  }
  return describedBy;
}

/**
 * Builds accessibility and disabled chrome for the pending/idle submit states.
 *
 * @param options - Resolved pending state and original button chrome
 * @returns Props to apply after Button passthrough
 */
export function submitButtonChromeProps(options: {
  disabled: SubmitButtonProps['disabled'];
  isPending: boolean;
  pendingDescriptionId: string;
  pendingLabel: string;
  propsAriaDescribedBy: string | undefined;
  title: SubmitButtonProps['title'];
  type: SubmitButtonProps['type'];
}) {
  const describedBy = joinDescribedByIds(
    options.propsAriaDescribedBy,
    options.isPending ? options.pendingDescriptionId : undefined
  );
  const title = options.isPending ? options.pendingLabel : options.title;
  const type = options.type ?? 'submit';
  const disabled = options.isPending || Boolean(options.disabled);

  return {
    'aria-busy': options.isPending || undefined,
    'aria-describedby': describedBy,
    disabled,
    title,
    type,
  } as const;
}
