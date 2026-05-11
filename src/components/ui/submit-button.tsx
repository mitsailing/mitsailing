'use client';

import { LoaderCircle } from 'lucide-react';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';

type SubmitButtonProps = React.ComponentProps<typeof Button> & {
  pending?: boolean;
  pendingLabel: string;
};

const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton(
    {
      children,
      disabled,
      pending,
      pendingLabel,
      title,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) {
    const formStatus = useFormStatus();
    const pendingDescriptionId = React.useId();
    const isPending = pending ?? formStatus.pending;
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
              <LoaderCircle aria-hidden className="size-4 animate-spin" />
              {children}
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
