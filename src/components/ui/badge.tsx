import { cva } from 'class-variance-authority';
import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary text-primary-foreground [a]:hover:bg-primary/90',
        secondary:
          'border-transparent bg-secondary text-secondary-foreground [a]:hover:bg-secondary/90',
        outline: 'border-border bg-background text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants>;

/**
 * Small status or filter label pill.
 *
 * @param props - Badge props
 * @returns Badge element
 */
function Badge(props: BadgeProps) {
  const { className, variant = 'default', ...rest } = props;
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...rest}
    />
  );
}

export { Badge };
