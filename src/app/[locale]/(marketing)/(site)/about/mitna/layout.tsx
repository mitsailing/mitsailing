import type { ReactNode } from 'react';

/**
 * `/about/mitna/**` subtree: chrome ({@link MitnaMarketingPageShell}) composes breadcrumbs
 * per page; this layout stays a shallow passthrough to avoid stacking duplicate shells.
 *
 * @param props - Nested route props
 * @returns Child segment
 */
export default function MitnaRouteGroupLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
