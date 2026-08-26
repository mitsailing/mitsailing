'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { FormSubmitTimeoutContext } from '@/components/ui/form-error-handling';

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

function submitButtonPassthroughProps(
  props: SubmitButtonProps
): React.ComponentProps<typeof Button> {
  const buttonProps = { ...props } as Record<string, unknown>;
  delete buttonProps.children;
  delete buttonProps.pending;
  delete buttonProps.pendingKind;
  delete buttonProps.pendingLabel;
  return buttonProps as React.ComponentProps<typeof Button>;
}

const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton(props: SubmitButtonProps, ref) {
    const tCommon = useTranslations('Common');
    const formStatus = useFormStatus();
    const submitTimedOut = React.useContext(FormSubmitTimeoutContext);
    const pendingDescriptionId = React.useId();
    const isPending =
      props.pending ??
      (formStatus.pending &&
        !submitTimedOut &&
        (props.formAction === undefined
          ? true
          : formStatus.action === props.formAction));
    const pendingLabel =
      props.pendingLabel ??
      (props.pendingKind ? tCommon(pendingKindKeys[props.pendingKind]) : '');
    const describedBy = [
      props['aria-describedby'],
      isPending ? pendingDescriptionId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <>
        <Button
          aria-busy={isPending || undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          ref={ref}
          {...submitButtonPassthroughProps(props)}
          disabled={isPending ? true : props.disabled}
          title={isPending ? pendingLabel : props.title}
          type={props.type ?? 'submit'}
        >
          {isPending ? (
            <>
              <LoaderCircle
                aria-hidden
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              {pendingLabel}
            </>
          ) : (
            props.children
          )}
        </Button>
        {isPending ? (
          <span
            aria-live="polite"
            className="sr-only"
            id={pendingDescriptionId}
          >
            {pendingLabel}
          </span>
        ) : null}
      </>
    );
  }
);
SubmitButton.displayName = 'SubmitButton';

export { SubmitButton };
