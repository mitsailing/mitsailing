import type { ReactNode } from 'react';

// About index and /about/:slug (non-MITNA) share this segment. Breadcrumb shells live in
// `(index)/layout` and `(detail)/[slug]/layout` so staff pages get a third crumb.

export default function AboutSectionLayout(props: {
  children: ReactNode;
}): ReactNode {
  return props.children;
}
