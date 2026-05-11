import * as React from 'react';
import { cn } from '@/lib/utils';
import { Link } from '@/libs/I18nNavigation';

type AdminPrimaryActionLinkProps = React.ComponentProps<typeof Link>;

const adminPrimaryActionLinkClassName =
  'rounded-md bg-mit-red px-3 py-1.5 text-sm font-semibold text-white no-underline hover:bg-mit-red-hover';

const adminSecondaryActionLinkClassName =
  'rounded-md border border-mit-line bg-background px-3 py-1.5 text-sm font-semibold text-mit-red no-underline hover:bg-mit-red-highlight';

/**
 * Locale-aware admin primary action styled as a compact red pill link.
 *
 * @param props - Forwarded to `Link` with merged default `className`
 * @returns Styled next-intl navigation link
 */
export function AdminPrimaryActionLink(props: AdminPrimaryActionLinkProps) {
  return (
    <Link
      {...props}
      className={cn(adminPrimaryActionLinkClassName, props.className)}
    />
  );
}

/**
 * Locale-aware admin secondary action link for non-primary navigation.
 *
 * @param props - Forwarded to `Link` with merged default `className`
 * @returns Styled next-intl navigation link
 */
export function AdminSecondaryActionLink(props: AdminPrimaryActionLinkProps) {
  return (
    <Link
      {...props}
      className={cn(adminSecondaryActionLinkClassName, props.className)}
    />
  );
}
