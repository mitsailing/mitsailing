'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { normalizeNavPath } from '@/lib/mit-sailing/navPathMatch';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import type { AdminNavItem } from '@/libs/admin/adminNavigation';
import { Link, usePathname } from '@/libs/I18nNavigation';

function isAdminNavItemActive(
  pathname: string,
  href: string,
  match: AdminNavItem['match']
): boolean {
  const p = normalizeNavPath(pathname);
  const h = normalizeNavPath(href);
  if (match === 'exact') {
    return p === h;
  }
  return p === h || p.startsWith(`${h}/`);
}

const rowFocus = textFocusRingClassName;

/** Stable id linking the collapse control to the nav region for assistive tech. */
const ADMIN_SIDE_NAV_REGION_ID = 'admin-sidenav';
const ADMIN_SIDE_NAV_COLLAPSED_STORAGE_KEY =
  'mitsailing-admin-sidenav-collapsed';

/** Same-tab signal: `storage` does not fire in the document that called `setItem`. */
const ADMIN_SIDE_NAV_COLLAPSED_CHANGED_EVENT =
  'mitsailing:admin-sidenav-collapsed-changed';

/** When `setItem` throws, snapshot still reflects the toggled value until storage or another tab updates. */
let adminSideNavCollapsedPersistenceFault: boolean | null = null;

function readAdminSideNavCollapsedFromStorage(): boolean {
  if (adminSideNavCollapsedPersistenceFault !== null) {
    return adminSideNavCollapsedPersistenceFault;
  }
  try {
    return (
      window.localStorage.getItem(ADMIN_SIDE_NAV_COLLAPSED_STORAGE_KEY) ===
      'true'
    );
  } catch {
    return false;
  }
}

function getAdminSideNavCollapsedServerSnapshot(): boolean {
  return false;
}

// Subscribes to cross-tab `storage` and the same-tab collapse sync event.
// With `getServerSnapshot`, React does not call this during SSR.
function subscribeAdminSideNavCollapsed(onStoreChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key !== null &&
      event.key !== ADMIN_SIDE_NAV_COLLAPSED_STORAGE_KEY
    ) {
      return;
    }
    adminSideNavCollapsedPersistenceFault = null;
    onStoreChange();
  };
  const onLocalChange = () => {
    onStoreChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(
    ADMIN_SIDE_NAV_COLLAPSED_CHANGED_EVENT,
    onLocalChange
  );
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(
      ADMIN_SIDE_NAV_COLLAPSED_CHANGED_EVENT,
      onLocalChange
    );
  };
}

/**
 * Tailwind Plus–style vertical rail (text rows) inside the marketing shell.
 * Renders only under {@link requireAdmin}.
 *
 * @param props - Side nav props
 * @returns Sidebar navigation for admin routes
 */
export function AdminSideNav(props: { items: readonly AdminNavItem[] }) {
  const t = useTranslations('AdminSideNav');
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(
    subscribeAdminSideNavCollapsed,
    readAdminSideNavCollapsedFromStorage,
    getAdminSideNavCollapsedServerSnapshot
  );
  const toggleLabel = collapsed ? t('expand_label') : t('collapse_label');

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 grow flex-col overflow-y-auto scrollbar-gutter-stable transition-[width,padding]',
        'border-mit-line bg-card px-4 pt-2 pb-3 md:pt-3 md:pb-4',
        'border-b md:border-b-0 md:border-r',
        collapsed ? 'md:w-14 md:px-2' : 'md:w-72 md:px-5'
      )}
    >
      <div className="mb-2 hidden justify-end md:flex">
        <Button
          aria-controls={ADMIN_SIDE_NAV_REGION_ID}
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          className="text-muted-foreground hover:text-foreground"
          size="icon-sm"
          title={toggleLabel}
          type="button"
          variant="ghost"
          onClick={() => {
            const next = !collapsed;
            adminSideNavCollapsedPersistenceFault = null;
            try {
              window.localStorage.setItem(
                ADMIN_SIDE_NAV_COLLAPSED_STORAGE_KEY,
                String(next)
              );
            } catch {
              adminSideNavCollapsedPersistenceFault = next;
            }
            window.dispatchEvent(
              new Event(ADMIN_SIDE_NAV_COLLAPSED_CHANGED_EVENT)
            );
          }}
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4" />
          )}
        </Button>
      </div>
      <nav
        aria-label={t('aria_label')}
        className={cn(
          'relative flex min-h-0 flex-1 flex-col',
          collapsed && 'md:hidden'
        )}
        id={ADMIN_SIDE_NAV_REGION_ID}
      >
        <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-y-2 p-0">
          <li>
            <ul className="m-0 -mx-2 list-none space-y-0.5 p-0">
              {props.items.map((item) => {
                const active = isAdminNavItemActive(
                  pathname,
                  item.href,
                  item.match
                );
                return (
                  <li key={item.href}>
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'block rounded-md px-2 py-1.5 text-left text-sm font-semibold text-mit-text leading-6 no-underline',
                        rowFocus,
                        active
                          ? 'bg-mit-surface text-mit-red dark:text-mit-red-ink'
                          : 'hover:bg-mit-surface'
                      )}
                      href={item.href}
                      prefetch={false}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        </ul>
      </nav>
    </div>
  );
}
