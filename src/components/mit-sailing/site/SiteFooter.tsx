import { getTranslations } from 'next-intl/server';
import { footerNavColumns } from '@/data/mit-sailing/footerNavSeed';
import { pavilionShippingAddress } from '@/data/mit-sailing/pavilionInfoSeed';
import { calendarYearInEventsTimeZone } from '@/lib/mit-sailing/nyTime';
import {
  footerCopyrightBarClassName,
  footerLegalLinkClassName,
  footerLinkClassName,
  footerNavLinkClassName,
  footerNavSectionHeadingClassName,
} from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import { loadCmsMenu } from '@/libs/mit-sailing/cmsQueries';
import type { PublicCmsMenuItem } from '@/libs/mit-sailing/cmsQueries';
import { footerMenuWithPricing } from '../siteNavigationRequiredLinks';
import { FooterSocialStrip } from './FooterSocialStrip';

function FooterMaybeInternalLink(props: {
  className: string;
  href: string;
  isExternal: boolean;
  children: React.ReactNode;
}) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return null;
  }
  if (!props.isExternal && isAppRelativeCmsHref(href)) {
    return (
      <Link className={props.className} href={href}>
        {props.children}
      </Link>
    );
  }
  return (
    <a className={props.className} href={href} {...externalCmsLinkProps(href)}>
      {props.children}
    </a>
  );
}

function footerSeedMenu(
  t: Awaited<ReturnType<typeof getTranslations<'MitSailingSite'>>>
): PublicCmsMenuItem[] {
  return footerNavColumns.map((column) => ({
    children: column.links.map((link) => ({
      children: [],
      href: 'to' in link ? link.to : link.href,
      id: `seed-${link.labelKey}`,
      isExternal: false,
      label: t(link.labelKey),
    })),
    id: `seed-${column.titleKey}`,
    isExternal: false,
    label: t(column.titleKey),
  }));
}

/**
 * Dark site footer: social strip, four-column nav, brand + address, and legal row.
 * Copy for labels comes from `MitSailingSite` in `en.json`. Structure + hrefs: `@/data/mit-sailing/*` (Prisma later).
 *
 * @returns Site-wide footer
 */
export async function SiteFooter() {
  const t = await getTranslations('MitSailingSite');
  const [footerMenu, legalMenu, socialMenu] = await Promise.all([
    loadCmsMenu('footer'),
    loadCmsMenu('legal'),
    loadCmsMenu('social'),
  ]);
  const footerMenuWithRequiredLinks = footerMenuWithPricing({
    footerMenu: footerMenu.length === 0 ? footerSeedMenu(t) : footerMenu,
    pricingLabel: t('footer_link_membership'),
  });
  const year = calendarYearInEventsTimeZone(new Date());
  const socialGroups = socialMenu.map((group) => ({
    id: group.id,
    label: group.label,
    links: group.children.flatMap((link) =>
      link.href
        ? [
            {
              id: link.id,
              label: link.label,
              href: link.href,
              network: link.systemKey,
            },
          ]
        : []
    ),
  }));

  return (
    <footer className="mt-auto bg-mit-footer py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <FooterSocialStrip
          groups={socialGroups}
          socialLinksLabel={t('footer_social_links_suffix')}
        />

        <div className="mb-16 grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)] lg:gap-14">
          <div>
            <div className="mb-6 font-mit-serif text-2xl font-bold tracking-tight">
              {t('site_brand_mit')}
              <span className="ml-1 font-medium">
                {t('site_brand_sailing')}
              </span>
            </div>
            <p className="mb-6 max-w-sm text-sm leading-relaxed">
              {t('footer_tagline')}
            </p>
            <address className="text-xs leading-relaxed not-italic">
              {pavilionShippingAddress.lines.map((line) => (
                <span className="block" key={line}>
                  {line}
                </span>
              ))}
            </address>
          </div>

          <nav
            aria-label={t('footer_navigation_aria')}
            className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3"
          >
            {footerMenuWithRequiredLinks.map((col) => (
              <div key={col.id}>
                <h4 className={`mb-4 ${footerNavSectionHeadingClassName}`}>
                  {col.label}
                </h4>
                <ul className="m-0 space-y-3 p-0">
                  {col.children.map((link) => {
                    if (!link.href) {
                      return null;
                    }
                    const href = safeCmsHref(link.href);
                    if (!href) {
                      return null;
                    }

                    return (
                      <li className="m-0 list-none" key={link.id}>
                        <FooterMaybeInternalLink
                          className={`${footerLinkClassName} ${footerNavLinkClassName} no-underline`}
                          href={href}
                          isExternal={link.isExternal}
                        >
                          {link.label}
                        </FooterMaybeInternalLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className={footerCopyrightBarClassName}>
          <p className="text-xs">{t('footer_copyright', { year })}</p>
          <nav aria-label={t('footer_legal_nav_aria')}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:justify-end">
              {legalMenu.map((item) =>
                item.href ? (
                  <FooterMaybeInternalLink
                    className={`${footerLinkClassName} ${footerLegalLinkClassName}`}
                    href={item.href}
                    isExternal={item.isExternal}
                    key={item.id}
                  >
                    {item.label}
                  </FooterMaybeInternalLink>
                ) : null
              )}
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
