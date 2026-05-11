import type * as React from 'react';

const publicCatalogDetailTopNavClassName =
  'mb-8 flex w-full min-w-0 flex-row flex-wrap items-center gap-x-4 gap-y-2';

/**
 * Single-row layout for a leading back link and trailing `PublicAdminEditLink`.
 * Uses a full-width row so `ml-auto` on the edit wrapper reaches the container edge; `min-w-0` avoids overflow in nested flex layouts.
 *
 * @param props - Row children (typically back `Link` then `PublicAdminEditLink` with `ml-auto`)
 * @returns Flex toolbar below breadcrumbs
 */
export function PublicCatalogDetailTopNav(props: {
  children: React.ReactNode;
}) {
  return (
    <div className={publicCatalogDetailTopNavClassName}>{props.children}</div>
  );
}
