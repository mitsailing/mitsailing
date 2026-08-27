import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Styled native `<select>` matching [`Input`](./input.tsx) chrome.
 *
 * Name follows [shadcn/ui Native Select](https://ui.shadcn.com/docs/components/radix/native-select)
 * to distinguish this from a future custom Radix `Select`.
 */
const nativeSelectClassName =
  'h-8 w-full min-w-0 cursor-pointer rounded-lg border border-input bg-transparent px-2.5 py-1 pr-9 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input-background dark:contrast-more:border-white';

function NativeSelect(props: React.ComponentProps<'select'>) {
  return (
    <select
      {...props}
      data-slot="native-select"
      className={cn(nativeSelectClassName, props.className)}
    />
  );
}

export { NativeSelect };
