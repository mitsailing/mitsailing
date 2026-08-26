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

const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton(
    {
      children,
      disabled,
      pending,
      pendingKind,
      pendingLabel: pendingLabelProp,
      title,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) {
    const tCommon = useTranslations('Common');
    const formStatus = useFormStatus();
    const pendingDescriptionId = React.useId();
    const isPending = pending ?? formStatus.pending;
    const pendingLabel =
      pendingLabelProp ??
      (pendingKind ? tCommon(pendingKindKeys[pendingKind]) : '');
    const describedBy = [
      ariaDescribedBy,
      isPending ? pendingDescriptionId : undefined,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <>
        <Button
          aria-busy={isPending || undefined}
          aria-describedby={describedBy.length > 0 ? describedBy : undefined}
          disabled={isPending ? true : disabled}
          ref={ref}
          title={isPending ? pendingLabel : title}
          type="submit"
          {...props}
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
            children
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
