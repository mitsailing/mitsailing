import type * as React from 'react';

/**
 * Home (`/`) layout: split so you can change hero width or metadata patterns
 * without touching the rest of the site tree.
 *
 * Locale and shared chrome are set in the parent `(marketing)/layout.tsx`.
 *
 * @param props - Layout props
 * @param props.children - Home page content
 * @returns Home route content
 */
export default function HomeLayout(props: {
  children: React.ReactNode;
}): React.ReactNode {
  return props.children;
}
