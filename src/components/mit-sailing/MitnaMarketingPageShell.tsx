import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { MitnaSubNavLayout } from '@/components/mit-sailing/MitnaSubNavLayout';
import type { SiteSectionBreadcrumbSegment } from '@/components/mit-sailing/SiteSectionBreadcrumbs';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';

/** MIT `/mitna/**` landing and doc pages. */
type MitnaPublicPageKind = 'landing' | 'constitution' | 'meetings' | 'hatch';

type MitnaMarketingPageShellProps = {
  locale: string;
  page: MitnaPublicPageKind;
  children: ReactNode;
};

/**
 * Marketing chrome for MITNA: breadcrumbs and subnav without a back link to About.
 *
 * @param props - Wrapper props
 * @returns Section shell with MITNA subnav
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

  if (page === 'landing') {
    segments = [{ label: t('mitna_title') }];
    variant = 'catalog';
  } else {
    let lastLabel = t('mitna_nav_constitution');
    if (page === 'meetings') {
      lastLabel = t('mitna_nav_meetings');
    } else if (page === 'hatch') {
      lastLabel = t('mitna_nav_hatch');
    }
    segments = [
      { href: '/mitna', label: t('mitna_title') },
      { label: lastLabel },
    ];
    variant = 'detail';
  }

  return (
    <SiteSectionShell locale={locale} segments={segments}>
      <SiteSectionMain variant={variant}>
        <MitnaSubNavLayout>{props.children}</MitnaSubNavLayout>
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
