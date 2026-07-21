'use client';

import { cn } from '@/lib/utils';
import type { AdminUserAccountTab } from '@/libs/admin/users/adminUserAccountTab';
import { adminUsersAccountTabPath } from '@/libs/admin/users/adminUserAccountTab';
import { Link } from '@/libs/I18nNavigation';

type AdminUserAccountTabOption = {
  readonly id: AdminUserAccountTab;
  readonly label: string;
};

type AdminUserAccountTabsProps = {
  readonly activeTab: AdminUserAccountTab;
  readonly ariaLabel: string;
  readonly tabs: readonly AdminUserAccountTabOption[];
  readonly userId: string;
};

/**
 * Sticky tab navigation for the member account workspace.
 *
 * @param props - Visible tabs and active selection
 * @returns Tab list markup
 */
export function AdminUserAccountTabs(props: AdminUserAccountTabsProps) {
  return (
    <nav
      aria-label={props.ariaLabel}
      className="sticky top-0 z-10 -mx-1 border-b border-border bg-background px-1"
    >
      <div className="flex gap-1 overflow-x-auto">
        {props.tabs.map((tab) => {
          const active = props.activeTab === tab.id;
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={cn(
                'border-b-2 px-4 py-3 text-sm font-semibold whitespace-nowrap no-underline transition-colors',
                active
                  ? 'border-mit-red text-mit-red'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
              href={adminUsersAccountTabPath(props.userId, tab.id)}
              key={tab.id}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
