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
      className={`inline-flex items-center gap-1 font-semibold text-mit-red hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
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
            className={`inline-flex items-center gap-1 font-semibold text-mit-red hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
            href={`/fleet/${boat.slug}`}
          >
            {boat.name} <ArrowRight aria-hidden size={14} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RatingClassLinks(props: {
  classes: PublicSailingRating['grantableClasses'];
  emptyLabel: string;
}) {
  if (props.classes.length === 0) {
    return <span>{props.emptyLabel}</span>;
  }

  return (
    <ul className="m-0 list-none space-y-1 p-0">
      {props.classes.map((sailingClass) => (
        <li key={sailingClass.id}>
          <Link
            className={`inline-flex items-center gap-1 font-semibold text-mit-red hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
            href={`/classes/${sailingClass.slug}`}
          >
            {sailingClass.name} <ArrowRight aria-hidden size={14} />
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

  if (props.ratings.length === 0) {
    return (
      <>
        <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
          {t('list_heading')}
        </h1>
        <div className="mb-8 max-w-3xl space-y-4 text-base leading-relaxed text-mit-text">
          <p>{t('list_intro')}</p>
          <p>{t('list_staff_note')}</p>
        </div>
        <p className="m-0 max-w-3xl text-base text-mit-text" role="status">
          {t('empty')}
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-mit-text">
        {t('list_heading')}
      </h1>
      <div className="mb-12 max-w-3xl space-y-4 text-base leading-relaxed text-mit-text">
        <p>{t('list_intro')}</p>
        <p>{t('list_staff_note')}</p>
      </div>

      {activeRatings.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-mit-line bg-mit-surface">
          <table className="w-full min-w-[1040px] table-fixed border-collapse text-left text-sm leading-relaxed text-mit-text">
            <thead className="bg-mit-red-highlight text-xs font-bold tracking-wider text-mit-text uppercase">
              <tr>
                <th className="w-[15%] px-4 py-3" scope="col">
                  {t('column_rating')}
                </th>
                <th className="w-[5%] px-4 py-3" scope="col">
                  {t('column_level')}
                </th>
                <th className="w-[27%] px-4 py-3" scope="col">
                  {t('column_description')}
                </th>
                <th className="w-[18%] px-4 py-3" scope="col">
                  {t('column_classes')}
                </th>
                <th className="w-[14%] px-4 py-3" scope="col">
                  {t('column_boats')}
                </th>
                <th className="w-[8%] px-4 py-3" scope="col">
                  {t('column_wind')}
                </th>
                <th className="w-[13%] px-4 py-3" scope="col">
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
                    <RatingClassLinks
                      classes={rating.grantableClasses}
                      emptyLabel={t('not_applicable')}
                    />
                  </td>
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
      ) : null}

      {deprecatedRatings.length > 0 ? (
        <section
          className={activeRatings.length > 0 ? 'mt-12' : 'mt-0 max-w-3xl'}
        >
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
