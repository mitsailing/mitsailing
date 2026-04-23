import { getTranslations } from 'next-intl/server';
import {
  footerNavColumns,
  footerLegalLinks,
} from '@/data/mit-sailing/footerNavSeed';
import { pavilionShippingAddress } from '@/data/mit-sailing/pavilionInfoSeed';
import {
  footerCopyrightBarClassName,
  footerLegalLinkClassName,
  footerLinkClassName,
  footerNavLinkClassName,
  footerNavSectionHeadingClassName,
} from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import { FooterSocialStrip } from './FooterSocialStrip';

/**
 * Dark site footer: social strip, four-column nav, brand + address, and legal row.
 * Copy for labels comes from `MitSailingSite` in `en.json`. Structure + hrefs: `@/data/mit-sailing/*` (Prisma later).
 *
 * @returns Site-wide footer
 */
export async function SiteFooter() {
  const t = await getTranslations('MitSailingSite');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-mit-footer py-16 text-white">
      <div className="mx-auto max-w-7xl px-6">
        <FooterSocialStrip />

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

          {footerNavColumns.map((col) => (
            <div key={col.titleKey}>
              <h4 className={`mb-6 ${footerNavSectionHeadingClassName}`}>
                {t(col.titleKey)}
              </h4>
              <ul className="space-y-4">
                {col.links.map((link) => (
                  <li key={link.labelKey}>
                    {'to' in link ? (
                      <Link
                        className={`${footerLinkClassName} ${footerNavLinkClassName} no-underline`}
                        href={link.to}
                      >
                        {t(link.labelKey)}
                      </Link>
                    ) : (
                      <a
                        className={`${footerLinkClassName} ${footerNavLinkClassName}`}
                        href={link.href}
                      >
                        {t(link.labelKey)}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className={footerCopyrightBarClassName}>
          <p className="text-xs">{t('footer_copyright', { year })}</p>
          <nav aria-label={t('footer_legal_nav_aria')}>
            <div className="flex gap-6">
              {footerLegalLinks.map((item) => (
                <a
                  className={`${footerLinkClassName} ${footerLegalLinkClassName}`}
                  href={item.href}
                  key={item.labelKey}
                >
                  {t(item.labelKey)}
                </a>
              ))}
            </div>
          </nav>
        </div>
      </div>
    </footer>
  );
}
