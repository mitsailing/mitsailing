'use client';

import { Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/libs/I18nNavigation';
import type { NavigationDropdownItem } from './NavigationDropdown';
import { NavigationDropdown } from './NavigationDropdown';

const navLinkClass =
  'text-sm font-medium text-mit-text no-underline transition-opacity hover:opacity-70';
const mobileLinkClassName = `min-h-[44px] rounded-sm py-3 no-underline transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none ${navLinkClass}`;

type NavConfigItem = {
  labelKey:
    | 'nav_classes'
    | 'nav_fleet'
    | 'nav_bluewater'
    | 'nav_racing'
    | 'nav_calendar'
    | 'nav_about'
    | 'nav_resources';
  href?: string;
  externalHref?: string;
  items?: NavigationDropdownItem[];
};

const mobileUtilityConfig: {
  labelKey: 'util_reserve_pavilion' | 'util_directions' | 'util_donate';
  href: string;
}[] = [
  { labelKey: 'util_reserve_pavilion', href: '/contact/' },
  { labelKey: 'util_directions', href: '/contact/' },
  { labelKey: 'util_donate', href: '/contact/' },
];

const navConfig: Omit<NavConfigItem, 'items'>[] = [
  { labelKey: 'nav_classes', href: '/classes/' },
  { labelKey: 'nav_fleet', href: '/fleet/' },
  { labelKey: 'nav_bluewater', externalHref: '#' },
  { labelKey: 'nav_racing', externalHref: '#' },
  { labelKey: 'nav_calendar', href: '/events/' },
  { labelKey: 'nav_about', href: '/about/' },
  { labelKey: 'nav_resources', externalHref: '#' },
];

export type SiteHeaderProps = {
  /** Items for the Fleet dropdown — generated server-side from the fleet seed. */
  fleetDropdownItems: NavigationDropdownItem[];
};

/**
 * Sticky top-of-page site header with primary nav, fleet dropdown, and mobile menu.
 *
 * @param props - Props
 * @param props.fleetDropdownItems - Items for the Fleet dropdown
 * @returns Sticky header with dropdowns and mobile menu
 */
export function SiteHeader(props: SiteHeaderProps) {
  const t = useTranslations('MitSailingSite');
  const tBase = useTranslations('BaseTemplate');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: NavConfigItem[] = useMemo(
    () =>
      navConfig.map((item) =>
        item.labelKey === 'nav_fleet'
          ? { ...item, items: props.fleetDropdownItems }
          : item
      ),
    [props.fleetDropdownItems]
  );

  const closeMobile = () => {
    setMobileMenuOpen(false);
  };

  const primaryNavAria = tBase('main_navigation_label');

  return (
    <header className="sticky top-0 z-50 border-b border-mit-line bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link
          className="flex cursor-pointer items-center gap-2 no-underline"
          href="/"
        >
          <div className="font-mit-serif text-[22px] font-bold tracking-tight text-mit-red">
            {t('site_brand_mit')}
            <span className="ml-1 text-mit-text">
              {t('site_brand_sailing')}
            </span>
          </div>
        </Link>

        <nav
          aria-label={primaryNavAria}
          className="hidden items-center gap-8 lg:flex"
        >
          {navItems.map((item) => {
            const label = t(item.labelKey);
            if (item.items && item.items.length > 0) {
              return (
                <NavigationDropdown
                  href={item.href}
                  items={item.items}
                  key={item.labelKey}
                  label={label}
                  overviewLabel={t('nav_overview_all', {
                    label: t('nav_fleet'),
                  })}
                  variant="desktop"
                />
              );
            }
            if (item.href) {
              return (
                <Link
                  className={navLinkClass}
                  href={item.href}
                  key={item.labelKey}
                >
                  {label}
                </Link>
              );
            }
            return (
              <a
                className={`${navLinkClass} transition-colors hover:opacity-70`}
                href={item.externalHref ?? '#'}
                key={item.labelKey}
              >
                {label}
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            className="inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-mit-red no-underline transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
            href="/sign-in/"
          >
            {t('auth_log_in')}
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-mit-red px-6 py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
            href="/sign-up/"
          >
            {t('auth_create_account')}
          </Link>
        </div>

        <button
          aria-controls="site-header-mobile-menu"
          aria-expanded={mobileMenuOpen}
          aria-label={
            mobileMenuOpen ? t('a11y_close_menu') : t('a11y_open_menu')
          }
          className="p-2 text-mit-text lg:hidden"
          onClick={() => {
            setMobileMenuOpen(!mobileMenuOpen);
          }}
          type="button"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div
          className="border-t border-mit-line bg-white px-6 py-4 lg:hidden"
          id="site-header-mobile-menu"
        >
          <nav aria-label={primaryNavAria} className="flex flex-col gap-1">
            {mobileUtilityConfig.map((link) => (
              <Link
                className={mobileLinkClassName}
                href={link.href}
                key={link.labelKey}
                onClick={closeMobile}
              >
                {t(link.labelKey)}
              </Link>
            ))}
            {navItems.map((item) => {
              const label = t(item.labelKey);
              if (item.items && item.items.length > 0) {
                return (
                  <NavigationDropdown
                    href={item.href}
                    items={item.items}
                    key={item.labelKey}
                    label={label}
                    onNavigate={closeMobile}
                    overviewLabel={t('nav_overview_all', {
                      label: t('nav_fleet'),
                    })}
                    variant="mobile"
                  />
                );
              }
              if (item.href) {
                return (
                  <Link
                    className={mobileLinkClassName}
                    href={item.href}
                    key={item.labelKey}
                    onClick={closeMobile}
                  >
                    {label}
                  </Link>
                );
              }
              return (
                <a
                  className={mobileLinkClassName}
                  href={item.externalHref ?? '#'}
                  key={item.labelKey}
                  onClick={closeMobile}
                >
                  {label}
                </a>
              );
            })}
          </nav>
          <div className="mt-4 flex flex-col gap-2 border-t border-mit-line pt-4">
            <Link
              className="inline-flex items-center justify-center rounded-lg py-3 text-sm font-medium text-mit-red no-underline transition-opacity hover:opacity-70 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/sign-in/"
              onClick={closeMobile}
            >
              {t('auth_log_in')}
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-mit-red px-6 py-2.5 text-sm font-medium text-white no-underline transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
              href="/sign-up/"
              onClick={closeMobile}
            >
              {t('auth_create_account')}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
