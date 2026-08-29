'use client';

import {
  AlertTriangle,
  Anchor,
  BookOpen,
  CalendarDays,
  CreditCard,
  FileText,
  Flag,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  ListTree,
  Mail,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sailboat,
  Settings2,
  Ship,
  Star,
  Tags,
  Users,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ComponentType } from 'react';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { normalizeNavPath } from '@/lib/mit-sailing/navPathMatch';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import type { AdminNavGroup, AdminNavItem } from '@/libs/admin/adminNavigation';
import { Link, usePathname } from '@/libs/I18nNavigation';
import type messages from '@/locales/en.json';

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

const ADMIN_NAV_ICONS: Partial<
  Record<
    keyof typeof messages.AdminSideNav,
    ComponentType<{ className?: string }>
  >
> = {
  nav_admin: LayoutDashboard,
  nav_users: Users,
  nav_pavilion_reservations: CalendarDays,
  nav_pavilion_spaces: LayoutGrid,
  nav_events: Flag,
  nav_payments: CreditCard,
  nav_newsletter_subscribers: Mail,
  nav_newsletter_lists: ListTree,
  nav_newsletter_broadcasts: Megaphone,
  nav_newsletter_templates: FileText,
  nav_email_templates: Mail,
  nav_donation_funds: Anchor,
  nav_event_categories: Tags,
  nav_class_categories: BookOpen,
  nav_sailing_classes: Sailboat,
  nav_sailing_ratings: Star,
  nav_sailing_rating_rules: Settings2,
  nav_fleet: Ship,
  nav_site_alerts: AlertTriangle,
  nav_cms_pages: FileText,
  nav_cms_page_blocks: Layers,
  nav_cms_menus: Menu,
  nav_cms_menu_items: ListTree,
};

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

function AdminNavLink(props: {
  readonly active: boolean;
  readonly collapsed: boolean;
  readonly href: string;
  readonly item: AdminNavItem;
  readonly label: string;
}) {
  const Icon = ADMIN_NAV_ICONS[props.item.labelKey] ?? LayoutDashboard;
  return (
    <Link
      aria-current={props.active ? 'page' : undefined}
      className={cn(
        'flex items-center rounded-md text-left text-sm font-semibold text-mit-text leading-6 no-underline',
        rowFocus,
        props.collapsed ? 'justify-center px-2 py-2' : 'gap-2 px-2 py-1.5',
        props.active
          ? 'bg-mit-surface text-mit-red dark:text-mit-red-ink'
          : 'hover:bg-mit-surface'
      )}
      href={props.href}
      prefetch={false}
      title={props.collapsed ? props.label : undefined}
    >
      <Icon aria-hidden className="size-4 shrink-0" />
      {props.collapsed ? (
        <span className="sr-only">{props.label}</span>
      ) : (
        <span className="min-w-0 truncate">{props.label}</span>
      )}
    </Link>
  );
}

/**
 * Vertical admin rail with grouped sections and icon-only collapse mode.
 *
 * @param props - Side nav props
 * @returns Sidebar navigation for admin routes
 */
export function AdminSideNav(props: {
  readonly groups: readonly AdminNavGroup[];
  readonly homeItem?: AdminNavItem;
}) {
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
        'relative flex flex-col transition-[width,padding]',
        'border-mit-line bg-card px-3 pt-2 pb-3 md:pt-3 md:pb-4',
        'border-b md:sticky md:top-4 md:max-h-[calc(100dvh-6rem)] md:self-start md:overflow-y-auto md:border-b-0 md:border-r',
        collapsed ? 'md:w-14 md:px-2' : 'md:w-64 md:px-4'
      )}
    >
      <div className="mb-2 flex justify-end">
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
        className="relative flex flex-col gap-4"
        id={ADMIN_SIDE_NAV_REGION_ID}
      >
        {props.homeItem ? (
          <AdminNavLink
            active={isAdminNavItemActive(
              pathname,
              props.homeItem.href,
              props.homeItem.match
            )}
            collapsed={collapsed}
            href={props.homeItem.href}
            item={props.homeItem}
            label={t(props.homeItem.labelKey)}
          />
        ) : null}
        {props.groups.map((group) => (
          <section
            aria-label={t(group.labelKey)}
            className="min-w-0"
            key={group.id}
          >
            {collapsed ? null : (
              <h2 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {t(group.labelKey)}
              </h2>
            )}
            <ul className="m-0 list-none space-y-0.5 p-0">
              {group.items.map((item) => (
                <li key={item.href}>
                  <AdminNavLink
                    active={isAdminNavItemActive(
                      pathname,
                      item.href,
                      item.match
                    )}
                    collapsed={collapsed}
                    href={item.href}
                    item={item}
                    label={t(item.labelKey)}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>
    </div>
  );
}
