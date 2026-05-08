'use client';

import { useTranslations } from 'next-intl';
import { normalizeNavPath } from '@/lib/mit-sailing/navPathMatch';
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
    | 'nav_sailing_ratings'
    | 'nav_sailing_rating_rules'
    | 'nav_fleet'
    | 'nav_site_alerts'
    | 'nav_site_text';
  /** `prefix` highlights all subpaths (e.g. event edit under `/admin/events/`). */
  match: 'exact' | 'prefix';
};

const ADMIN_SITE_NAV: AdminNavItem[] = [
  { href: '/admin/', labelKey: 'nav_admin', match: 'exact' },
  { href: '/admin/site_text/', labelKey: 'nav_site_text', match: 'prefix' },
  { href: '/admin/users/', labelKey: 'nav_users', match: 'prefix' },
  {
    href: '/admin/donation_funds/',
    labelKey: 'nav_donation_funds',
    match: 'prefix',
  },
  { href: '/admin/events/', labelKey: 'nav_events', match: 'prefix' },
  {
    href: '/admin/event_categories/',
    labelKey: 'nav_event_categories',
    match: 'prefix',
  },
  {
    href: '/admin/class_categories/',
    labelKey: 'nav_class_categories',
    match: 'prefix',
  },
  {
    href: '/admin/sailing_classes/',
    labelKey: 'nav_sailing_classes',
    match: 'prefix',
  },
  {
    href: '/admin/sailing_ratings/',
    labelKey: 'nav_sailing_ratings',
    match: 'prefix',
  },
  {
    href: '/admin/sailing_rating_rules/',
    labelKey: 'nav_sailing_rating_rules',
    match: 'prefix',
  },
  { href: '/admin/fleet/', labelKey: 'nav_fleet', match: 'prefix' },
  {
    href: '/admin/site_alerts/',
    labelKey: 'nav_site_alerts',
    match: 'prefix',
  },
];

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

/**
 * Tailwind Plus–style vertical rail (text rows) inside the marketing shell.
 * Renders only under {@link requireAdmin}.
 *
 * @returns Sidebar navigation for admin routes
 */
export function AdminSideNav() {
  const t = useTranslations('AdminSideNav');
  const pathname = usePathname();

  return (
    <div
      className={cn(
        'relative flex h-full min-h-0 grow flex-col overflow-y-auto',
        'border-mit-line bg-card px-4 pt-2 pb-3 md:px-5 md:pt-3 md:pb-4',
        'border-b md:border-b-0 md:border-r'
      )}
    >
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
                          ? 'bg-mit-surface text-mit-red-ink'
                          : 'hover:bg-mit-surface'
                      )}
                      href={item.href}
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
