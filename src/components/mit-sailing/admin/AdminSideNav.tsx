'use client';

import {
  CalendarDays,
  CircleDollarSign,
  FileText,
  FolderTree,
  Home,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Sailboat,
  Tags,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { isAdminNavItemActive } from '@/components/mit-sailing/admin/adminNavMatch';
import type { AdminNavMatchMode } from '@/components/mit-sailing/admin/adminNavMatch';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link, usePathname } from '@/libs/I18nNavigation';

type AdminNavItem = {
  href: string;
  labelKey:
    | 'nav_admin'
    | 'nav_users'
    | 'nav_donation_funds'
    | 'nav_events'
    | 'nav_event_categories'
    | 'nav_class_categories'
    | 'nav_sailing_classes'
    | 'nav_fleet'
    | 'nav_site_text';
  /** `prefix` highlights all subpaths (e.g. event edit under `/admin/events/`). */
  match: AdminNavMatchMode;
  icon: LucideIcon;
};

const ADMIN_SITE_NAV: AdminNavItem[] = [
  { href: '/admin/', icon: Home, labelKey: 'nav_admin', match: 'exact' },
  {
    href: '/admin/site_text/',
    icon: FileText,
    labelKey: 'nav_site_text',
    match: 'prefix',
  },
  {
    href: '/admin/users/',
    icon: Users,
    labelKey: 'nav_users',
    match: 'prefix',
  },
  {
    href: '/admin/donation_funds/',
    icon: CircleDollarSign,
    labelKey: 'nav_donation_funds',
    match: 'prefix',
  },
  {
    href: '/admin/events/',
    icon: CalendarDays,
    labelKey: 'nav_events',
    match: 'prefix',
  },
  {
    href: '/admin/event_categories/',
    icon: Tags,
    labelKey: 'nav_event_categories',
    match: 'prefix',
  },
  {
    href: '/admin/class_categories/',
    icon: FolderTree,
    labelKey: 'nav_class_categories',
    match: 'prefix',
  },
  {
    href: '/admin/sailing_classes/',
    icon: ListTree,
    labelKey: 'nav_sailing_classes',
    match: 'prefix',
  },
  {
    href: '/admin/fleet/',
    icon: Sailboat,
    labelKey: 'nav_fleet',
    match: 'prefix',
  },
];

const rowFocus = textFocusRingClassName;

/**
 * Tailwind Plus–style vertical rail (text rows) inside the marketing shell.
 * Renders only under {@link requireAdmin}.
 *
 * @returns Sidebar navigation for admin routes
 */
export function AdminSideNav() {
  const t = useTranslations('AdminSideNav');
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 grow flex-col overflow-y-auto transition-[width] duration-200',
        'border-mit-line bg-card px-4 pt-2 pb-3 md:pt-3 md:pb-4',
        'border-b md:border-b-0 md:border-r',
        collapsed ? 'md:w-[4.5rem] md:px-3' : 'md:w-72 md:px-5'
      )}
    >
      <div className="mb-2 hidden justify-end md:flex">
        <button
          aria-label={collapsed ? t('action_expand') : t('action_collapse')}
          aria-pressed={collapsed}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-md text-mit-text hover:bg-mit-surface',
            rowFocus
          )}
          onClick={() => {
            setCollapsed((prev) => !prev);
          }}
          title={collapsed ? t('action_expand') : t('action_collapse')}
          type="button"
        >
          {collapsed ? (
            <PanelLeftOpen aria-hidden className="size-4" />
          ) : (
            <PanelLeftClose aria-hidden className="size-4" />
          )}
        </button>
      </div>
      <nav
        aria-label={t('aria_label')}
        className="relative flex min-h-0 flex-1 flex-col"
      >
        <ul
          className="m-0 flex min-h-0 flex-1 list-none flex-col gap-y-2 p-0"
          role="list"
        >
          <li>
            <ul className="m-0 -mx-2 list-none space-y-0.5 p-0" role="list">
              {ADMIN_SITE_NAV.map((item) => {
                const active = isAdminNavItemActive({
                  href: item.href,
                  match: item.match,
                  pathname,
                });
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-mit-text leading-6 no-underline',
                        rowFocus,
                        collapsed && 'md:justify-center',
                        active
                          ? 'bg-mit-surface text-mit-red-ink'
                          : 'hover:bg-mit-surface'
                      )}
                      href={item.href}
                      title={collapsed ? t(item.labelKey) : undefined}
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      <span className={cn(collapsed && 'md:sr-only')}>
                        {t(item.labelKey)}
                      </span>
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
