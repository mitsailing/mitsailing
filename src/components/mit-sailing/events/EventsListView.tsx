import { getTranslations } from 'next-intl/server';
import { Link } from '@/libs/I18nNavigation';
import {
  formatEasternDateTime,
  formatEasternEventRange,
} from '@/libs/mit-sailing/easternTimeFormat';
import type { listPublishedEventsForPublic } from '@/libs/mit-sailing/eventQueries';

type EventRow = Awaited<
  ReturnType<typeof listPublishedEventsForPublic>
>[number];

type EventsListViewProps = {
  locale: string;
  events: EventRow[];
};

/**
 * @param props - List view props
 * @param props.locale - Active locale
 * @param props.events - Published events from the database
 * @returns Server-rendered event list
 */
export async function EventsListView(props: EventsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingEvents',
  });

  if (props.events.length === 0) {
    return <p className="text-muted-foreground">{t('list_empty')}</p>;
  }

  return (
    <ul className="flex flex-col gap-4">
      {props.events.map((e) => (
        <li key={e.id}>
          <article className="rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-foreground">
                <Link
                  className="text-primary-ink no-underline hover:underline"
                  href={`/events/${e.slug}/`}
                >
                  {e.name}
                </Link>
                {e.isSpecial ? (
                  <span className="ms-2 text-xs font-medium text-amber-800 uppercase dark:text-amber-400">
                    {t('badge_special')}
                  </span>
                ) : null}
              </h2>
              <p className="text-sm text-muted-foreground">{e.category.name}</p>
            </div>
            {e.dates[0] ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {e.dates[0].endDateTime
                  ? formatEasternEventRange(
                      e.dates[0].startDateTime,
                      e.dates[0].endDateTime
                    )
                  : formatEasternDateTime(e.dates[0].startDateTime)}
              </p>
            ) : null}
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
              {e.description}
            </p>
          </article>
        </li>
      ))}
    </ul>
  );
}
