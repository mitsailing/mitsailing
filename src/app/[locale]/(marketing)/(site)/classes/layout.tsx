import type { ReactNode } from 'react';

/**
 * Classes segment: breadcrumbs live on `page.tsx` / `[slug]/layout.tsx`.
 *
 * @param props - Layout props
 * @returns Child routes
 */
export default function ClassesRoutesLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
