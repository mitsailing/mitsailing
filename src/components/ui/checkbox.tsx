import type * as React from 'react';
import { cn } from '@/lib/utils';

/** Shared Tailwind classes for native checkbox inputs (focus ring matches [`Input`](./input.tsx)). */
const checkboxClassName =
  'size-4 shrink-0 rounded border border-input text-primary accent-primary transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50';

function Checkbox(props: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      {...props}
      data-slot="checkbox"
      type="checkbox"
      className={cn(checkboxClassName, props.className)}
    />
  );
}

export { Checkbox };
