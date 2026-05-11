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
 * Native checkbox styled as a switch plus a hidden `"false"` fallback so `<form action>` +
 * `FormData.get(...)` reads `"true"` when checked and `"false"` when unchecked.
 *
 * @param props - `name`/`id` for the hidden field and switch; optional `defaultChecked` and a11y props.
 * @returns Checkbox switch plus hidden fallback field.
 */
export function RegistrationBooleanSwitch(
  props: RegistrationBooleanSwitchProps
) {
  return (
    <label
      className={cn(
        'relative inline-flex h-7 w-12 shrink-0 cursor-pointer',
        props.className
      )}
      htmlFor={props.id}
    >
      <input
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid'] ? true : undefined}
        aria-labelledby={props['aria-labelledby']}
        aria-required={props['aria-required'] ? true : undefined}
        className="peer sr-only"
        defaultChecked={props.defaultChecked}
        id={props.id}
        name={props.name}
        role="switch"
        type="checkbox"
        value="true"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full border-2 border-border bg-secondary shadow-inner transition-[color,box-shadow] peer-checked:border-mit-red peer-checked:bg-mit-red peer-checked:shadow-none peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-1 left-0.5 block size-5 rounded-full border border-black/15 bg-white shadow-md ring-0 transition-[left] peer-checked:left-[1.625rem] dark:border-black/25"
      />
      <input name={props.name} type="hidden" value="false" />
    </label>
  );
}
