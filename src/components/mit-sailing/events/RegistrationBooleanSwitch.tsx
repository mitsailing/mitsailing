'use client';

import { Switch } from '@headlessui/react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type RegistrationBooleanSwitchProps = {
  className?: string;
  defaultChecked?: boolean;
  id: string;
  name: string;
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

  return (
    <Switch
      aria-describedby={props['aria-describedby']}
      aria-invalid={props['aria-invalid'] ? true : undefined}
      aria-labelledby={props['aria-labelledby']}
      aria-required={props['aria-required'] ? true : undefined}
      className={cn(
        'group inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full border-2 border-border bg-secondary p-0.5 shadow-inner transition-colors outline-none data-checked:border-mit-red data-checked:bg-mit-red data-focus:border-ring data-focus:ring-3 data-focus:ring-ring/50',
        props.className
      )}
      checked={checked}
      data-switch-id={props.id}
      name={props.name}
      onChange={setChecked}
      value="true"
    >
      <span
        aria-hidden
        className="pointer-events-none block size-5 translate-x-0 rounded-full border border-black/15 bg-white shadow-md ring-0 transition-transform group-data-checked:translate-x-5 dark:border-black/25"
      />
    </Switch>
  );
}
