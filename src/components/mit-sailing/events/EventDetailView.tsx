import { getTranslations } from 'next-intl/server';
import { AdminEditLink } from '@/components/mit-sailing/AdminEditLink';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';
import type { getPublishedEventForPublicBySlug } from '@/libs/mit-sailing/eventQueries';

type EventDetail = NonNullable<
  Awaited<ReturnType<typeof getPublishedEventForPublicBySlug>>
>;

type EventDetailViewProps = {
  adminEditHref?: string;
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
      <div className="mb-4 flex items-center justify-between gap-4 text-sm">
        <Link className="text-blue-800 hover:underline" href="/events/">
          {t('back_to_list')}
        </Link>
        {props.adminEditHref ? (
          <AdminEditLink href={props.adminEditHref} locale={props.locale} />
        ) : null}
      </div>
      <header className="border-b border-slate-200 pb-4">
        <h1 className="text-3xl font-semibold text-slate-900">{e.name}</h1>
        {e.shortName && e.shortName !== e.name ? (
          <p className="mt-1 text-lg text-slate-600">{e.shortName}</p>
        ) : null}
        <p className="mt-2 text-sm text-slate-600">
          <span className="font-medium text-slate-800">
            {t('field_category')}
            {': '}
          </span>
          {e.category.name}
        </p>
        {e.isSpecial ? (
          <p className="mt-1 text-sm font-medium text-amber-800 uppercase">
            {t('badge_special')}
          </p>
        ) : null}
      </header>

      {e.detailPageKind === 'external' && e.externalDetailUrl ? (
        <p className="mt-6">
          <a
            className="inline-flex items-center rounded-md bg-blue-800 px-4 py-2 text-sm font-medium text-white hover:bg-blue-900"
            href={e.externalDetailUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {t('external_cta')}
          </a>
        </p>
      ) : null}

      <div className="mt-6 max-w-prose text-base leading-relaxed text-slate-800">
        <p className="whitespace-pre-wrap">{e.description}</p>
      </div>

      {e.dates.length > 0 ? (
        <section className="mt-8" aria-labelledby="event-schedule-heading">
          <h2
            className="text-lg font-semibold text-slate-900"
            id="event-schedule-heading"
          >
            {t('field_schedule')}
          </h2>
          <ul className="mt-3 list-none space-y-2 p-0">
            {e.dates.map((d) => (
              <li
                className="rounded border border-slate-100 bg-slate-50 px-3 py-2 text-slate-800"
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
