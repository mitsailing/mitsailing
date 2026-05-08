import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { SiteAlertsListView } from '@/components/mit-sailing/alerts/SiteAlertsListView';
import { listPublishedSiteAlerts } from '@/libs/mit-sailing/siteAlertQueries';

const ALERTS_HEADING_ID = 'site-alerts-heading';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingAlerts',
  });
  return { title: t('meta_title') };
}

/**
 * Public site alerts index (published rows from `site_alerts`).
 *
 * @param props - Page props
 * @param props.params - `[locale]` route params
 * @returns Alerts list in marketing shell
 */
export default async function SiteAlertsPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingAlerts',
  });
  const alerts = await listPublishedSiteAlerts();

  return (
    <div>
      <h1
        id={ALERTS_HEADING_ID}
        className="mb-3 text-2xl font-semibold text-foreground"
      >
        {t('page_heading')}
      </h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
        {t('page_intro')}
      </p>
      <SiteAlertsListView
        locale={locale}
        headingId={ALERTS_HEADING_ID}
        alerts={alerts}
      />
    </div>
  );
}
