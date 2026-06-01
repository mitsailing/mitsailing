'use client';

import { useRef } from 'react';
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
    </div>
  );
}
