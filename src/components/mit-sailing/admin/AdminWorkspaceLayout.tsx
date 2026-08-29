import type { ReactNode } from 'react';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';

type AdminWorkspaceLayoutProps = {
  readonly children: ReactNode;
  readonly sidebar: ReactNode;
};

/**
 * Admin list/detail workspace: sidebar rail plus a compact main column.
 *
 * @param props - Workspace layout props
 * @returns Two-column admin shell
 */
export function AdminWorkspaceLayout(props: AdminWorkspaceLayoutProps) {
  return (
    <SiteSidebarLayout
      className="gap-3 md:gap-4"
      density="content-fit"
      mobileNavLabel="Admin menu"
      sidebar={props.sidebar}
    >
      <div className="flex min-w-0 flex-col gap-4">{props.children}</div>
    </SiteSidebarLayout>
  );
}
