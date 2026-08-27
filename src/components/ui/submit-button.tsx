'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import {
  buttonPassthroughProps,
  resolveIsPending,
  resolvePendingLabel,
  submitButtonChrome,
} from '@/components/ui/submit-button-state';
import type { SubmitButtonProps } from '@/components/ui/submit-button-state';

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
  const tCommon = useTranslations('Common');
  const formStatus = useFormStatus();
  const pendingDescriptionId = React.useId();

  const isPending = resolveIsPending({
    formAction: props.formAction,
    formStatus,
    pending: props.pending,
  });
  const label = resolvePendingLabel({
    pendingKind: props.pendingKind,
    pendingLabel: props.pendingLabel,
    translate: tCommon,
  });

  return (
    <>
      <Button
        {...buttonPassthroughProps(props)}
        {...submitButtonChrome({
          ariaDescribedBy: props['aria-describedby'],
          disabled: props.disabled,
          isPending,
          pendingDescriptionId,
          pendingLabel: label,
          title: props.title,
          type: props.type,
        })}
      >
        {isPending ? (
          <>
            <LoaderCircle
              aria-hidden
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {label}
          </>
        ) : (
          props.children
        )}
      </Button>
      {isPending ? (
        <span aria-live="polite" className="sr-only" id={pendingDescriptionId}>
          {label}
        </span>
      ) : null}
    </>
  );
}

export { SubmitButton };
