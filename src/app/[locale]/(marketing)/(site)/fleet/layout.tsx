import type { ReactNode } from 'react';

/**
 * Fleet segment: breadcrumbs on `page.tsx` / `[slug]/layout.tsx`.
 *
 * @param props - Layout props
 * @returns Child routes
 */
export default function FleetRoutesLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
