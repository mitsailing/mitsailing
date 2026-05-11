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
    <span
      className={cn('relative inline-flex h-7 w-12 shrink-0', props.className)}
    >
      <input
        aria-describedby={props['aria-describedby']}
        aria-invalid={props['aria-invalid'] ? true : undefined}
        aria-labelledby={props['aria-labelledby']}
        aria-required={props['aria-required'] ? true : undefined}
        className="peer absolute inset-0 z-20 cursor-pointer opacity-0"
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
        className="pointer-events-none absolute top-1/2 left-0.5 block size-5 -translate-y-1/2 rounded-full border border-black/15 bg-white shadow-md ring-0 transition-transform will-change-transform peer-checked:translate-x-6 dark:border-black/25"
      />
      <input name={props.name} type="hidden" value="false" />
    </span>
  );
}
