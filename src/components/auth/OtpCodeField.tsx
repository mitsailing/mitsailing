'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type OtpCodeFieldProps = Readonly<{
  containerClassName?: string;
  id: string;
  inputClassName?: string;
  label: string;
  labelClassName?: string;
  name: string;
  onValueChange: (value: string) => void;
  pasteButtonClassName?: string;
  pasteLabel: string;
  placeholder: string;
  value: string;
}>;

export function extractOtpCode(value: string): string {
  const isolatedCode = /(?:^|\D)(\d{6})(?!\d)/u.exec(value);
  if (isolatedCode?.[1]) {
    return isolatedCode[1];
  }
  return value.replaceAll(/\D/gu, '').slice(0, 6);
}

export function OtpCodeField(props: OtpCodeFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function onPasteButtonClick() {
    try {
      const text = await navigator.clipboard?.readText?.();
      const pastedCode = extractOtpCode(text ?? '');
      if (pastedCode) {
        props.onValueChange(pastedCode);
      }
    } finally {
      inputRef.current?.focus();
    }
  }

  function onInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    props.onValueChange(extractOtpCode(event.target.value));
  }

  function onInputPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pastedCode = extractOtpCode(event.clipboardData.getData('text'));
    if (!pastedCode) {
      return;
    }
    event.preventDefault();
    props.onValueChange(pastedCode);
  }

  return (
    <div className={props.containerClassName}>
      <Label className={cn('sr-only', props.labelClassName)} htmlFor={props.id}>
        {props.label}
      </Label>
      <Input
        autoCapitalize="none"
        autoComplete="one-time-code"
        autoCorrect="off"
        className={props.inputClassName}
        enterKeyHint="done"
        id={props.id}
        inputMode="numeric"
        maxLength={6}
        minLength={6}
        name={props.name}
        onChange={onInputChange}
        onPaste={onInputPaste}
        pattern="[0-9]{6}"
        placeholder={props.placeholder}
        ref={inputRef}
        required
        spellCheck={false}
        type="text"
        value={props.value}
      />
      <Button
        className={cn(
          'mt-2 h-auto min-h-0 px-0 py-0 font-medium shadow-none hover:bg-transparent hover:underline',
          props.pasteButtonClassName
        )}
        onClick={() => {
          // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the paste promise.
          void onPasteButtonClick();
        }}
        type="button"
        variant="link"
      >
        {props.pasteLabel}
      </Button>
    </div>
  );
}
