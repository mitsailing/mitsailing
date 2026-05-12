'use client';

import { useTranslations } from 'next-intl';
import { normalizeNavPath } from '@/lib/mit-sailing/navPathMatch';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { Link, usePathname } from '@/libs/I18nNavigation';

type ProfileNavItem = {
  href: string;
  labelKey:
    | 'nav_account'
    | 'nav_ratings'
    | 'nav_password'
    | 'nav_security'
    | 'nav_delete';
};

const PROFILE_NAV: ProfileNavItem[] = [
  { href: '/profile/account', labelKey: 'nav_account' },
  { href: '/profile/ratings', labelKey: 'nav_ratings' },
  { href: '/profile/password', labelKey: 'nav_password' },
  { href: '/profile/security', labelKey: 'nav_security' },
  { href: '/profile/delete', labelKey: 'nav_delete' },
];

function isProfileNavActive(pathname: string, href: string): boolean {
  const p = normalizeNavPath(pathname);
  const h = normalizeNavPath(href);
  return p === h || p.startsWith(`${h}/`);
}

const rowFocus = textFocusRingClassName;

/**
 * Vertical settings rail for `/profile/*` (GitHub-style subpages).
 *
 * @returns Sidebar navigation for profile routes
 */
export function ProfileSideNav() {
  const t = useTranslations('ProfileSideNav');
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
              {PROFILE_NAV.map((item) => {
                const active = isProfileNavActive(pathname, item.href);
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
