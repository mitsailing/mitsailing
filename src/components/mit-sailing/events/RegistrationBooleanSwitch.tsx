'use client';

import { Switch } from '@headlessui/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type RegistrationBooleanSwitchProps = {
  className?: string;
  defaultChecked?: boolean;
  id: string;
  name: string;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
  'aria-labelledby'?: string;
  'aria-required'?: boolean;
};

/**
 * Headless UI switch styled for MIT event forms.
 *
 * @param props - `name`/`id` for form submission and accessibility wiring
 * @returns Headless UI switch with native form participation
 */
export function RegistrationBooleanSwitch(
  props: RegistrationBooleanSwitchProps
) {
  const [checked, setChecked] = useState(props.defaultChecked ?? false);
  const inputRef = useRef<HTMLInputElement>(null);
  const isRequired = props.required ?? props['aria-required'];

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) {
      return;
    }

    const resetChecked = () => {
      setChecked(props.defaultChecked ?? false);
    };

    form.addEventListener('reset', resetChecked);
    return () => {
      form.removeEventListener('reset', resetChecked);
    };
  }, [props.defaultChecked]);

  return (
    <>
      <input
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid'] ? true : undefined}
        aria-labelledby={props['aria-labelledby']}
        aria-required={isRequired ? true : undefined}
        checked={checked}
        className="sr-only"
        id={props.id}
        name={props.name}
        onChange={(event) => {
          const nextChecked = event.currentTarget.checked;
          setChecked(nextChecked);
          props.onCheckedChange?.(nextChecked);
        }}
        ref={inputRef}
        required={isRequired ? true : undefined}
        tabIndex={-1}
        type="checkbox"
        value="true"
      />
      <Switch
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid'] ? true : undefined}
        aria-labelledby={props['aria-labelledby']}
        aria-required={isRequired ? true : undefined}
        className={cn(
          'group inline-flex h-11 w-16 shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-secondary p-1 shadow-inner transition-colors outline-none motion-reduce:transition-none data-checked:border-mit-red data-checked:bg-mit-red data-focus:border-ring data-focus:ring-3 data-focus:ring-ring/50 md:h-7 md:w-12 md:p-0.5',
          props.className
        )}
        checked={checked}
        data-switch-id={props.id}
        onChange={(nextChecked) => {
          setChecked(nextChecked);
          props.onCheckedChange?.(nextChecked);
        }}
        value="true"
      >
        <span
          aria-hidden
          className="pointer-events-none block size-7 translate-x-0 rounded-full border border-black/15 bg-white shadow-md ring-0 transition-transform group-data-checked:translate-x-6 motion-reduce:transition-none md:size-5 md:group-data-checked:translate-x-5 dark:border-black/25"
        />
      </Switch>
    </>
  );
}
