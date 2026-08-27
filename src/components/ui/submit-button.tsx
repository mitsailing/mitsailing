'use client';

import { LoaderCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { FormSubmitTimeoutContext } from '@/components/ui/form-submit-timeout-context';
import {
  isSubmitButtonPending,
  resolveSubmitPendingLabel,
  submitButtonChromeProps,
  submitButtonPassthroughProps,
} from '@/components/ui/submit-button-state';
import type { SubmitButtonProps } from '@/components/ui/submit-button-state';

function renderSubmitButtonLabel(options: {
  children: React.ReactNode;
  isPending: boolean;
  pendingLabel: string;
}): React.ReactNode {
  if (options.isPending) {
    return (
      <>
        <LoaderCircle
          aria-hidden
          className="size-4 animate-spin motion-reduce:animate-none"
        />
        {options.pendingLabel}
      </>
    );
  }
  return options.children;
}

function renderSubmitButtonPendingDescription(options: {
  id: string;
  isPending: boolean;
  label: string;
}): React.ReactNode {
  if (!options.isPending) {
    return null;
  }
  return (
    <span aria-live="polite" className="sr-only" id={options.id}>
      {options.label}
    </span>
  );
}

const SubmitButton = React.forwardRef<HTMLButtonElement, SubmitButtonProps>(
  function SubmitButton(props: SubmitButtonProps, ref) {
    const tCommon = useTranslations('Common');
    const formStatus = useFormStatus();
    const submitTimedOut = React.useContext(FormSubmitTimeoutContext);
    const pendingDescriptionId = React.useId();
    const isPending = isSubmitButtonPending({
      formAction: props.formAction,
      formPending: formStatus.pending,
      formStatusAction: formStatus.action,
      pendingProp: props.pending,
      submitTimedOut,
    });
    const pendingLabel = resolveSubmitPendingLabel({
      pendingKind: props.pendingKind,
      pendingLabel: props.pendingLabel,
      translate: tCommon,
    });
    const chromeProps = submitButtonChromeProps({
      disabled: props.disabled,
      isPending,
      pendingDescriptionId,
      pendingLabel,
      propsAriaDescribedBy: props['aria-describedby'],
      title: props.title,
      type: props.type,
    });

    return (
      <>
        <Button
          ref={ref}
          {...submitButtonPassthroughProps(props)}
          {...chromeProps}
        >
          {renderSubmitButtonLabel({
            children: props.children,
            isPending,
            pendingLabel,
          })}
        </Button>
        {renderSubmitButtonPendingDescription({
          id: pendingDescriptionId,
          isPending,
          label: pendingLabel,
        })}
      </>
    );
  }
);
SubmitButton.displayName = 'SubmitButton';

export { SubmitButton };
