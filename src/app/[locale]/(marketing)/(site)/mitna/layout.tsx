import type { ReactNode } from 'react';

/**
 * `/mitna/**` subtree: chrome composes breadcrumbs per page.
 *
 * @param props - Nested route props
 * @returns Child segment
 */
export default function MitnaRouteGroupLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
