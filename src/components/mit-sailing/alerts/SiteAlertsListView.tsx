import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { sanitizeSiteAlertBodyHtml } from '@/libs/mit-sailing/sanitizeSiteAlertHtml';
import type { SiteAlertPublicItem } from '@/libs/mit-sailing/siteAlertTypes';

type SiteAlertsListViewProps = {
  locale: string;
  headingId: string;
  alerts: SiteAlertPublicItem[];
};

/**
 * @param props - List props
 * @param props.locale - Active locale
 * @param props.headingId - Page `h1` id for `aria-labelledby`
 * @param props.alerts - Items to render (newest-first)
 * @returns Server-rendered alert list
 */
export async function SiteAlertsListView(props: SiteAlertsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingAlerts',
  });

  if (props.alerts.length === 0) {
    return <p className="text-muted-foreground">{t('list_empty')}</p>;
  }

  return (
    <ul aria-labelledby={props.headingId} className="flex flex-col gap-4">
      {props.alerts.map((item) => {
        const dateIso = item.startDateIso;
        return (
          <li key={item.id}>
            <Card role="article">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <time
                    className="text-sm font-medium text-foreground tabular-nums"
                    dateTime={dateIso}
                  >
                    {formatEasternShortDateFromIsoCalendar(dateIso)}
                  </time>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div
                  className="site-alert-body text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
                  // eslint-disable-next-line react/no-danger -- trusted subset after sanitizeSiteAlertBodyHtml
                  dangerouslySetInnerHTML={{
                    __html: sanitizeSiteAlertBodyHtml(item.body),
                  }}
                />
              </CardContent>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
