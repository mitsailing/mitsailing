import type { ReactNode } from 'react';

/**
 * Fleet segment pass-through; breadcrumbs and constrained main column live on
 * `page.tsx` and `[slug]/layout.tsx` (`SiteSectionShell` + `SiteSectionMain`).
 *
 * @param props - Layout props
 * @returns Child routes
 */
export default function FleetRoutesLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
