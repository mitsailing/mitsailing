import { getTranslations } from 'next-intl/server';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import type { NewsPublicItem } from '@/libs/mit-sailing/newsTypes';
import { sanitizeNewsBodyHtml } from '@/libs/mit-sailing/sanitizeNewsHtml';

type NewsListViewProps = {
  locale: string;
  headingId: string;
  items: NewsPublicItem[];
};

/**
 * @param props - List props
 * @param props.locale - Active locale
 * @param props.headingId - Page `h1` id for `aria-labelledby`
 * @param props.items - Items to render (newest-first)
 * @returns Server-rendered news list
 */
export async function NewsListView(props: NewsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingNews',
  });

  if (props.items.length === 0) {
    return <p className="text-muted-foreground">{t('list_empty')}</p>;
  }

  return (
    <ul aria-labelledby={props.headingId} className="flex flex-col gap-4">
      {props.items.map((item) => {
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
                  className="news-body text-sm leading-relaxed whitespace-pre-line text-muted-foreground [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_em]:italic [&_p]:m-0 [&_p+p]:mt-3 [&_strong]:font-semibold"
                  // eslint-disable-next-line react/no-danger -- trusted subset after sanitizeNewsBodyHtml
                  dangerouslySetInnerHTML={{
                    __html: sanitizeNewsBodyHtml(item.body),
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
