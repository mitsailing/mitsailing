import type * as React from 'react';

/**
 * Standard marketing pages. Auth-only flows use `src/app/[locale]/(auth)/`
 * instead.
 *
 * Locale and shared chrome are set in the parent `(marketing)/layout.tsx`.
 *
 * @param props - Layout props
 * @param props.children - Page content under `(site)/`
 * @returns Marketing site page content
 */
export default function MarketingSiteLayout(props: {
  children: React.ReactNode;
}): React.ReactNode {
  return props.children;
}
