'use client';

import { Menu, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { SignOutForm } from '@/components/auth/SignOutForm';
import { Button } from '@/components/ui/button';
import { useRouteHash } from '@/hooks/useRouteHash';
import { isNavLinkActive } from '@/lib/mit-sailing/navPathMatch';
import { authClient } from '@/libs/auth-client';
import { adminHeaderLinkVisibleFromClientSessionData } from '@/libs/auth/adminHeaderLink';
import { Link, usePathname } from '@/libs/I18nNavigation';
import type { NavigationDropdownItem } from './NavigationDropdown';
import { NavigationDropdown } from './NavigationDropdown';
import { SiteBrandWordmarkTypography } from './SiteBrandWordmarkTypography';

const navLinkClass =
  'text-sm font-medium text-mit-text no-underline transition-colors duration-200 hover:text-primary-ink dark:hover:text-white aria-[current=page]:font-semibold aria-[current=page]:text-primary-ink dark:aria-[current=page]:text-white';

const mobileLinkClassName = `min-h-[44px] rounded-sm py-3 focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${navLinkClass}`;

type NavConfigItem = {
  labelKey:
    | 'nav_classes'
    | 'nav_fleet'
    | 'nav_bluewater'
    | 'nav_racing'
    | 'nav_calendar'
    | 'nav_about'
    | 'nav_resources'
    | 'nav_sailing_ratings';
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
  { labelKey: 'util_donate', href: '/donate/' },
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

const desktopAuthOuterClass =
  'hidden min-h-[42px] min-w-[280px] items-center justify-end gap-2 lg:flex';

const desktopGuestLoginClass =
  'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium text-primary-ink no-underline transition-colors duration-200 dark:text-white dark:hover:text-white/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none';

const desktopGuestSignupClass =
  'inline-flex items-center justify-center rounded-lg bg-mit-red px-6 py-2.5 text-sm font-medium text-white no-underline shadow-sm transition-colors duration-200 hover:bg-mit-red-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none';

const desktopSignOutClass = `${desktopGuestLoginClass} cursor-pointer border-none bg-transparent disabled:opacity-60`;

const mobileGuestLoginClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg py-3 text-sm font-medium text-primary-ink no-underline transition-colors duration-200 dark:text-white dark:hover:text-white/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none';

const mobileGuestSignupClass =
  'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-mit-red px-6 py-2.5 text-sm font-medium text-white no-underline shadow-sm transition-colors duration-200 hover:bg-mit-red-hover focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none';

const mobileSignOutClass =
  'inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center rounded-lg border border-mit-red px-6 py-2.5 text-sm font-medium text-mit-red-ink transition-colors duration-200 hover:bg-mit-red/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none disabled:opacity-60';

function sessionHasUser(data: unknown): data is { user: { id: string } } {
  if (!data || typeof data !== 'object') {
    return false;
  }
  const { user } = data as { user?: unknown };
  if (!user || typeof user !== 'object') {
    return false;
  }
  const { id } = user as { id?: unknown };
  return typeof id === 'string' && id.length > 0;
}

export type SiteHeaderProps = {
  /** Items for the Fleet dropdown — generated server-side from Prisma. */
  fleetDropdownItems: NavigationDropdownItem[];
  /** Items for the Classes dropdown (ordered categories → `/classes/#slug`). */
  classesDropdownItems: NavigationDropdownItem[];
  /**
   * Session snapshot from the parent RSC (`getSession`). When set, the auth
   * controls render immediately from SSR instead of waiting on the client
   * `useSession()` fetch (no loading placeholder flash).
   */
  initialSignedIn?: boolean;
  /**
   * Admin nav visibility from the parent RSC (`getSession`). When defined, the
   * Admin link matches SSR during a pending client session fetch.
   */
  initialShowAdminLink?: boolean;
};

/**
 * Sticky top-of-page site header with primary nav, fleet/classes dropdowns, and mobile menu.
 *
 * @param props - Props
 * @param props.fleetDropdownItems - Items for the Fleet dropdown
 * @param props.classesDropdownItems - Items for the Classes dropdown
 * @returns Sticky header with dropdowns and mobile menu
 */
export function SiteHeader(props: SiteHeaderProps) {
  const t = useTranslations('MitSailingSite');
  const tAccount = useTranslations('AccountLayout');
  const locale = useLocale();
  const pathname = usePathname();
  const routeHash = useRouteHash();
  const sessionState = authClient.useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobilePortalReady, setMobilePortalReady] = useState(false);
  const [mobileDisclosureEpoch, setMobileDisclosureEpoch] = useState(0);

  const mobileMenuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileOverlayRef = useRef<HTMLDivElement>(null);
  const prevMobileOpenRef = useRef(false);

  const mobileNavHeadingId = useId();

  const hasServerAuthHint = props.initialSignedIn !== undefined;
  const { isPending } = sessionState;
  const clientAuthenticated = sessionHasUser(sessionState.data);

  const displayAuthenticated =
    isPending && hasServerAuthHint
      ? Boolean(props.initialSignedIn)
      : clientAuthenticated;

  const showAuthPending = isPending && !hasServerAuthHint;

  const hasServerAdminHint = props.initialShowAdminLink !== undefined;
  const clientAdminLinkVisible = adminHeaderLinkVisibleFromClientSessionData(
    sessionState.data
  );

  const displayAdminLink =
    isPending && hasServerAdminHint
      ? Boolean(props.initialShowAdminLink)
      : clientAdminLinkVisible;

  const navItems: NavConfigItem[] = navConfig.map((item) => {
    if (item.labelKey === 'nav_fleet') {
      return { ...item, items: props.fleetDropdownItems };
    }
    if (item.labelKey === 'nav_classes') {
      return {
        ...item,
        items: [
          { href: '/ratings/', label: t('nav_sailing_ratings') },
          ...props.classesDropdownItems,
        ],
      };
    }
    return item;
  });

  function closeMobile() {
    setMobileMenuOpen(false);
    setMobileDisclosureEpoch((n) => n + 1);
  }

  const closeMobileRef = useRef(closeMobile);

  closeMobileRef.current = closeMobile;

  function primaryNavBranch(branchProps: {
    disclosureEpoch?: number;
    flatLinkClass: string;
    item: NavConfigItem;
    onNavigate?: () => void;
    variant: 'desktop' | 'mobile';
  }) {
    const { item, variant, flatLinkClass, disclosureEpoch, onNavigate } =
      branchProps;
    const label = t(item.labelKey);

    const listKey =
      variant === 'mobile'
        ? `${item.labelKey}-${disclosureEpoch ?? 0}`
        : item.labelKey;

    if (item.href && item.items !== undefined) {
      const overviewLabel =
        item.labelKey === 'nav_classes'
          ? t('nav_overview_all', { label: t('nav_classes') })
          : t('nav_fleet_dropdown_overview');
      return (
        <NavigationDropdown
          href={item.href}
          items={item.items}
          key={listKey}
          label={label}
          overviewLabel={overviewLabel}
          pathname={pathname}
          routeHash={routeHash}
          variant={variant}
          onNavigate={onNavigate}
        />
      );
    }

    if (item.href) {
      const flatActive = isNavLinkActive(pathname, routeHash, item.href);
      return (
        <Link
          aria-current={flatActive ? 'page' : undefined}
          className={flatLinkClass}
          href={item.href}
          key={item.labelKey}
          onClick={onNavigate}
        >
          {label}
        </Link>
      );
    }

    const externalClassName = flatLinkClass;

    return (
      <a
        className={externalClassName}
        href={item.externalHref ?? '#'}
        key={item.labelKey}
        onClick={onNavigate}
      >
        {label}
      </a>
    );
  }

  useEffect(() => {
    setMobilePortalReady(true);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      return;
    }

    const { documentElement } = document;
    const { body } = document;
    const previousHtmlOverflow = documentElement.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    documentElement.style.overflow = 'hidden';
    body.style.overflow = 'hidden';

    let shellForInert: HTMLElement | undefined;
    const candidateShell = document.querySelector('#site-shell-inert-scope');
    if (
      candidateShell instanceof HTMLElement &&
      'inert' in HTMLElement.prototype
    ) {
      shellForInert = candidateShell;
      shellForInert.inert = true;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      event.preventDefault();
      closeMobileRef.current();
    };

    document.addEventListener('keydown', onKeyDown, true);

    const focusFrame = window.requestAnimationFrame(() => {
      const root = mobileOverlayRef.current;
      if (!root) {
        return;
      }
      const firstInteractive = root.querySelector<HTMLElement>(
        'nav a[href]:not([tabindex="-1"]), nav button:not([disabled])'
      );
      firstInteractive?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', onKeyDown, true);
      documentElement.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      if (shellForInert) {
        shellForInert.inert = false;
      }
    };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (mobileMenuOpen) {
      prevMobileOpenRef.current = true;
      return;
    }
    if (prevMobileOpenRef.current) {
      mobileMenuToggleRef.current?.focus();
      prevMobileOpenRef.current = false;
    }
  }, [mobileMenuOpen]);

  const primaryNavAria = t('main_navigation_label');

  function renderMobileNavBody() {
    return (
      <>
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
          {navItems.map((item) =>
            primaryNavBranch({
              disclosureEpoch: mobileDisclosureEpoch,
              flatLinkClass: mobileLinkClassName,
              item,
              onNavigate: closeMobile,
              variant: 'mobile',
            })
          )}
        </nav>
        <div className="mt-4 flex min-h-[92px] flex-col gap-2 border-t border-mit-line pt-4">
          {showAuthPending ? (
            <div
              aria-busy="true"
              aria-live="polite"
              className="flex min-h-[92px] flex-col justify-center"
              role="status"
            >
              <span className="sr-only">
                {t('a11y_header_session_loading')}
              </span>
            </div>
          ) : null}
          {!showAuthPending && !displayAuthenticated ? (
            <>
              <Link
                className={mobileGuestLoginClass}
                href="/login/"
                onClick={closeMobile}
              >
                {t('auth_log_in')}
              </Link>
              <Link
                className={mobileGuestSignupClass}
                href="/signup/"
                onClick={closeMobile}
              >
                {t('auth_create_account')}
              </Link>
            </>
          ) : null}
          {!showAuthPending && displayAuthenticated ? (
            <>
              {displayAdminLink ? (
                <Link
                  className={`${mobileGuestLoginClass} w-full`}
                  href="/admin/"
                  onClick={closeMobile}
                >
                  {tAccount('admin_link')}
                </Link>
              ) : null}
              <Link
                className={`${mobileGuestLoginClass} w-full`}
                href="/profile/"
                onClick={closeMobile}
              >
                {tAccount('user_profile_link')}
              </Link>
              <SignOutForm
                buttonClassName={mobileSignOutClass}
                label={tAccount('sign_out')}
                locale={locale}
                onSignOutStart={closeMobile}
                redirectPath="/"
              />
            </>
          ) : null}
        </div>
      </>
    );
  }

  const mobilePortalContent =
    mobilePortalReady && mobileMenuOpen
      ? createPortal(
          <div
            aria-labelledby={mobileNavHeadingId}
            aria-modal="true"
            className="fixed inset-0 z-[53] flex h-[100dvh] flex-col overflow-hidden bg-background pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] motion-safe:animate-in motion-safe:duration-200 motion-safe:fade-in motion-reduce:animate-none lg:hidden"
            id="site-header-mobile-menu"
            ref={mobileOverlayRef}
            role="dialog"
          >
            <h2 className="sr-only" id={mobileNavHeadingId}>
              {primaryNavAria}
            </h2>
            <div className="flex min-h-[4rem] shrink-0 items-center justify-between border-b border-mit-line px-6">
              <Link
                className="flex cursor-pointer items-center gap-2 no-underline focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
                href="/"
                onClick={closeMobile}
              >
                <SiteBrandWordmarkTypography
                  mitLabel={t('site_brand_mit')}
                  sailingLabel={t('site_brand_sailing')}
                  variant="shell"
                />
              </Link>
              <Button
                aria-controls="site-header-mobile-menu"
                aria-expanded
                aria-label={t('a11y_close_menu')}
                className="shrink-0 text-mit-text"
                size="icon"
                type="button"
                variant="ghost"
                onClick={closeMobile}
              >
                <X size={24} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6">
              {renderMobileNavBody()}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <header className="sticky top-0 z-50 border-b border-mit-line bg-background/85 backdrop-blur-md backdrop-saturate-150 dark:bg-background dark:backdrop-blur-none">
      <div className="mx-auto flex h-[4.25rem] max-w-7xl items-center justify-between gap-4 px-6 sm:px-8">
        <Link
          className="flex cursor-pointer items-center gap-2 no-underline"
          href="/"
        >
          <SiteBrandWordmarkTypography
            mitLabel={t('site_brand_mit')}
            sailingLabel={t('site_brand_sailing')}
            variant="shell"
          />
        </Link>

        <nav
          aria-label={primaryNavAria}
          className="hidden items-center gap-6 lg:flex xl:gap-7"
        >
          {navItems.map((item) =>
            primaryNavBranch({
              flatLinkClass: navLinkClass,
              item,
              variant: 'desktop',
            })
          )}
        </nav>

        <div className={desktopAuthOuterClass}>
          {showAuthPending ? (
            <div
              aria-busy="true"
              aria-live="polite"
              className="flex min-h-[42px] min-w-[280px] items-center justify-end"
              role="status"
            >
              <span className="sr-only">
                {t('a11y_header_session_loading')}
              </span>
            </div>
          ) : null}
          {!showAuthPending && !displayAuthenticated ? (
            <>
              <Link className={desktopGuestLoginClass} href="/login/">
                {t('auth_log_in')}
              </Link>
              <Link className={desktopGuestSignupClass} href="/signup/">
                {t('auth_create_account')}
              </Link>
            </>
          ) : null}
          {!showAuthPending && displayAuthenticated ? (
            <>
              {displayAdminLink ? (
                <Link className={desktopGuestLoginClass} href="/admin/">
                  {tAccount('admin_link')}
                </Link>
              ) : null}
              <Link className={desktopGuestLoginClass} href="/profile/">
                {tAccount('user_profile_link')}
              </Link>
              <SignOutForm
                buttonClassName={desktopSignOutClass}
                label={tAccount('sign_out')}
                locale={locale}
                redirectPath="/"
              />
            </>
          ) : null}
        </div>

        <Button
          ref={mobileMenuToggleRef}
          aria-controls="site-header-mobile-menu"
          aria-expanded={mobileMenuOpen}
          aria-label={
            mobileMenuOpen ? t('a11y_close_menu') : t('a11y_open_menu')
          }
          className={`shrink-0 text-mit-text lg:hidden${mobileMenuOpen ? ' pointer-events-none opacity-0' : ''}`}
          disabled={!mobilePortalReady}
          size="icon"
          type="button"
          variant="ghost"
          onClick={() => {
            setMobileMenuOpen((open) => !open);
          }}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </Button>
      </div>

      {mobilePortalContent}
    </header>
  );
}
