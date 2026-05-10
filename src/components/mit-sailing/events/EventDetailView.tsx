import { getTranslations } from 'next-intl/server';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';
import type { getPublishedEventForPublicBySlug } from '@/libs/mit-sailing/eventQueries';

type EventDetail = NonNullable<
  Awaited<ReturnType<typeof getPublishedEventForPublicBySlug>>
>;

type EventDetailViewProps = {
  locale: string;
  event: EventDetail;
};

/**
 * @param props - Detail view props
 * @param props.locale - Active locale
 * @param props.event - Published event with category and dates
 * @returns Server-rendered event detail
 */
export async function EventDetailView(props: EventDetailViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingEvents',
  });
  const e = props.event;

  return (
    <article>
      <PublicAdminEditLink href={`/admin/events/${e.slug}/edit`} />
      <p className="mb-4 text-sm text-muted-foreground">
        <Link
          className="text-primary-ink no-underline hover:underline"
          href="/events"
        >
          {t('back_to_list')}
        </Link>
      </p>
      <header className="border-b border-border pb-4">
        <h1 className="text-3xl font-semibold text-foreground">{e.name}</h1>
        {e.shortName && e.shortName !== e.name ? (
          <p className="mt-1 text-lg text-muted-foreground">{e.shortName}</p>
        ) : null}
        <p className="mt-2 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {t('field_category')}
            {': '}
          </span>
          {e.category.name}
        </p>
        {e.isSpecial ? (
          <p className="mt-1 text-sm font-medium text-amber-800 uppercase dark:text-amber-400">
            {t('badge_special')}
          </p>
        ) : null}
      </header>

      {e.detailPageKind === 'external' && e.externalDetailUrl ? (
        <p className="mt-6">
          <a
            className="inline-flex items-center rounded-md bg-mit-red px-4 py-2 text-sm font-medium text-white no-underline hover:bg-mit-red-hover"
            href={e.externalDetailUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('external_cta')}
          </a>
        </p>
      ) : null}

      <div className="mt-6 max-w-prose text-base leading-relaxed text-foreground">
        <p className="whitespace-pre-wrap">{e.description}</p>
      </div>

      {e.dates.length > 0 ? (
        <section className="mt-8" aria-labelledby="event-schedule-heading">
          <h2
            className="text-lg font-semibold text-foreground"
            id="event-schedule-heading"
          >
            {t('field_schedule')}
          </h2>
          <ul className="mt-3 list-none space-y-2 p-0">
            {e.dates.map((d) => (
              <li
                className="rounded border border-border bg-muted px-3 py-2 text-foreground"
                key={d.id}
              >
                {formatEasternEventRange(d.startDateTime, d.endDateTime)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
