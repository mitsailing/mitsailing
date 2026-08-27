'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

const pendingKindKeys = {
  adding: 'pending_adding',
  deleting: 'pending_deleting',
  saving: 'pending_saving',
  sending: 'pending_sending',
  submitting: 'pending_submitting',
} as const;

type SubmitPendingKind = keyof typeof pendingKindKeys;

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean;
} & (
    | { pendingLabel: string; pendingKind?: never }
    | { pendingKind: SubmitPendingKind; pendingLabel?: string }
  );

/**
 * Submit control that renders a spinner while its own submit is in flight.
 *
 * Explicit `pending` wins. Otherwise the nearest form must be pending, and an
 * optional `formAction` must match the action currently in flight so sibling
 * submits stay interactive.
 *
 * @param props - Button props plus `pending`, `pendingKind`, or `pendingLabel`
 * @returns Button with pending chrome and a polite pending announcement
 */
function SubmitButton(props: SubmitButtonProps) {
  // Destructured so the SubmitButton-only props never reach the DOM button.
  const { pending, pendingKind, pendingLabel, ...buttonProps } = props;
  const tCommon = useTranslations('Common');
  const formStatus = useFormStatus();
  const pendingDescriptionId = React.useId();

  const isPending =
    pending ??
    (formStatus.pending &&
      (props.formAction === undefined ||
        formStatus.action === props.formAction));

  const resolvedPendingLabel =
    pendingLabel ?? (pendingKind ? tCommon(pendingKindKeys[pendingKind]) : '');

  const describedBy = [
    props['aria-describedby'],
    isPending ? pendingDescriptionId : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <Button
        {...buttonProps}
        aria-busy={isPending || undefined}
        aria-describedby={describedBy || undefined}
        disabled={isPending || Boolean(props.disabled)}
        title={isPending ? resolvedPendingLabel : props.title}
        type={props.type ?? 'submit'}
      >
        {isPending ? (
          <>
            <LoaderCircle
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {resolvedPendingLabel}
          </>
        ) : (
          props.children
        )}
      </Button>
      {isPending ? (
        <span aria-live="polite" className="sr-only" id={pendingDescriptionId}>
          {resolvedPendingLabel}
        </span>
      ) : null}
    </>
  );
}

export { SubmitButton };
