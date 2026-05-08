import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { PublicSailingRating } from '@/libs/mit-sailing/sailingRatingQueries';

type RatingsListViewProps = {
  locale: string;
  ratings: PublicSailingRating[];
};

function RatingGuideLink(props: { guideUrl: string | null; label: string }) {
  if (!props.guideUrl) {
    return null;
  }

  return (
    <a
      className={`inline-flex items-center gap-1 font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
      href={props.guideUrl}
      rel="noopener noreferrer"
      target="_blank"
    >
      {props.label} <ArrowRight aria-hidden size={14} />
    </a>
  );
}

function RatingBoatLinks(props: {
  boats: PublicSailingRating['unlockedBoats'];
  emptyLabel: string;
}) {
  if (props.boats.length === 0) {
    return <span>{props.emptyLabel}</span>;
  }

  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {props.boats.map((boat) => (
        <li key={boat.id}>
          <Link
            className={`inline-flex items-center gap-1 font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
            href={`/fleet/${boat.slug}/`}
          >
            {boat.name} <ArrowRight aria-hidden size={14} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export async function RatingsListView(props: RatingsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRatings',
  });

  const activeRatings = props.ratings.filter((rating) => !rating.isDeprecated);
  const deprecatedRatings = props.ratings.filter(
    (rating) => rating.isDeprecated
  );

  return (
    <>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {t('list_heading')}
      </h1>
      <div className="mb-12 max-w-3xl space-y-4 text-base leading-relaxed text-mit-text">
        <p>{t('list_intro')}</p>
        <p>{t('list_staff_note')}</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-mit-line bg-mit-surface">
        <table className="w-full min-w-[860px] border-collapse text-left text-sm leading-relaxed text-mit-text">
          <thead className="bg-mit-red-highlight text-xs font-bold tracking-wider text-mit-text uppercase">
            <tr>
              <th className="w-[16%] px-4 py-3" scope="col">
                {t('column_rating')}
              </th>
              <th className="w-[6%] px-4 py-3" scope="col">
                {t('column_level')}
              </th>
              <th className="w-[34%] px-4 py-3" scope="col">
                {t('column_description')}
              </th>
              <th className="w-[18%] px-4 py-3" scope="col">
                {t('column_boats')}
              </th>
              <th className="w-[10%] px-4 py-3" scope="col">
                {t('column_wind')}
              </th>
              <th className="w-[16%] px-4 py-3" scope="col">
                {t('column_guide')}
              </th>
            </tr>
          </thead>
          <tbody>
            {activeRatings.map((rating) => (
              <tr
                className="scroll-mt-28 border-t border-mit-line align-top"
                id={rating.slug}
                key={rating.id}
              >
                <th className="px-4 py-4 font-semibold" scope="row">
                  <div>{rating.name}</div>
                  {rating.category ? (
                    <div className="mt-1 text-xs font-medium text-mit-text">
                      {rating.category}
                    </div>
                  ) : null}
                </th>
                <td className="px-4 py-4">
                  {rating.level ?? t('not_applicable')}
                </td>
                <td className="px-4 py-4">{rating.description}</td>
                <td className="px-4 py-4">
                  <RatingBoatLinks
                    boats={rating.unlockedBoats}
                    emptyLabel={t('not_applicable')}
                  />
                </td>
                <td className="px-4 py-4">
                  {rating.windCondition ?? t('not_applicable')}
                </td>
                <td className="px-4 py-4">
                  {rating.guideUrl ? (
                    <RatingGuideLink
                      guideUrl={rating.guideUrl}
                      label={t('guide_link')}
                    />
                  ) : (
                    t('not_applicable')
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {deprecatedRatings.length > 0 ? (
        <section className="mt-12">
          <h2 className="mb-3 font-mit-serif text-xl font-semibold text-mit-text md:text-2xl">
            {t('section_deprecated')}
          </h2>
          <ul className="m-0 list-disc space-y-2 pl-5">
            {deprecatedRatings.map((rating) => (
              <li
                className="text-sm leading-relaxed text-mit-text"
                id={rating.slug}
                key={rating.id}
              >
                <span className="font-semibold">{rating.name}</span>
                {' — '}
                {rating.description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
