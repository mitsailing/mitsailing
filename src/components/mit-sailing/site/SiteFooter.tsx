import { getTranslations } from 'next-intl/server';
import { pavilionShippingAddress } from '@/data/mit-sailing/pavilionInfoSeed';
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
  const year = new Date().getFullYear();
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
        <FooterSocialStrip groups={socialGroups} />

        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
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

          {footerMenu.map((col) => (
            <div key={col.id}>
              <h4 className={`mb-6 ${footerNavSectionHeadingClassName}`}>
                {col.label}
              </h4>
              <ul className="space-y-4">
                {col.children.map((link) =>
                  link.href ? (
                    <li key={link.id}>
                      <FooterMaybeInternalLink
                        className={`${footerLinkClassName} ${footerNavLinkClassName} no-underline`}
                        href={link.href}
                        isExternal={link.isExternal}
                      >
                        {link.label}
                      </FooterMaybeInternalLink>
                    </li>
                  ) : null
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className={footerCopyrightBarClassName}>
          <p className="text-xs">{t('footer_copyright', { year })}</p>
          <nav aria-label={t('footer_legal_nav_aria')}>
            <div className="flex gap-6">
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
