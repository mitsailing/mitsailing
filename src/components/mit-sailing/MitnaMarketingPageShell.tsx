import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MitnaSubNavLayout } from '@/components/mit-sailing/MitnaSubNavLayout';
import type { SiteSectionBreadcrumbSegment } from '@/components/mit-sailing/SiteSectionBreadcrumbs';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

/** MIT `/about/mitna/**` landing and doc pages (not staff bios). */
type MitnaPublicPageKind = 'landing' | 'constitution' | 'meetings' | 'hatch';

type MitnaMarketingPageShellProps = {
  locale: string;
  page: MitnaPublicPageKind;
  children: ReactNode;
};

/**
 * Standard marketing chrome for MITNA: {@link SiteSectionShell} + {@link SiteSectionMain} +
 * {@link MitnaSubNavLayout}. Landing links back to `/about/`; deeper pages link to `/about/mitna/`.
 *
 * @param props - Wrapper props
 * @param props.locale - Active locale
 * @param props.page - Which MITNA surface (drives breadcrumbs and spacing)
 * @param props.children - Right-column body next to {@link MitnaSubNavColumn}
 * @returns Full section tree below global {@link SiteShell}
 */
export async function MitnaMarketingPageShell(
  props: MitnaMarketingPageShellProps
) {
  const { locale, page } = props;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });

  let segments: SiteSectionBreadcrumbSegment[];
  let variant: 'catalog' | 'detail';
  let backHref: '/about/' | '/about/mitna/';
  let backLabel: string;

  if (page === 'landing') {
    segments = [
      { href: '/about/', label: t('section_about') },
      { label: t('mitna_title') },
    ];
    variant = 'catalog';
    backHref = '/about/';
    backLabel = t('mitna_back_about');
  } else {
    let lastLabel = t('mitna_nav_constitution');
    if (page === 'meetings') {
      lastLabel = t('mitna_nav_meetings');
    } else if (page === 'hatch') {
      lastLabel = t('mitna_nav_hatch');
    }
    segments = [
      { href: '/about/', label: t('section_about') },
      { href: '/about/mitna/', label: t('mitna_title') },
      { label: lastLabel },
    ];
    variant = 'detail';
    backHref = '/about/mitna/';
    backLabel = t('mitna_back_overview');
  }

  return (
    <SiteSectionShell locale={locale} segments={segments}>
      <SiteSectionMain variant={variant}>
        <MitnaSubNavLayout>
          <>
            <Link
              className={`mb-6 inline-flex items-center gap-1.5 rounded-sm text-sm font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName}`}
              href={backHref}
            >
              <ArrowLeft aria-hidden size={16} />
              {backLabel}
            </Link>
            {props.children}
          </>
        </MitnaSubNavLayout>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
