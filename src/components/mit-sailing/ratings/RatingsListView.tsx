import { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { PublicSailingRating } from '@/libs/mit-sailing/sailingRatingQueries';

type RatingsListViewProps = {
  locale: string;
  ratings: PublicSailingRating[];
};

type RatingFactLink = {
  href: string;
  id: string;
  name: string;
};

const ratingLinkClassName = `font-semibold text-mit-red hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`;

function RatingPageIntro(props: {
  heading: string;
  intro: string;
  staffNote: string;
}) {
  return (
    <>
      <h1 className="mb-3 font-mit-serif text-[clamp(1.75rem,4vw,2.25rem)] leading-tight font-semibold tracking-tight text-balance text-mit-text">
        {props.heading}
      </h1>
      <div className="mb-10 max-w-3xl space-y-4 text-base leading-relaxed text-pretty text-mit-text">
        <p>{props.intro}</p>
        <p>{props.staffNote}</p>
      </div>
    </>
  );
}

function RatingFactLinks(props: {
  emptyLabel: string;
  items: RatingFactLink[];
}) {
  if (props.items.length === 0) {
    return <span>{props.emptyLabel}</span>;
  }

  return (
    <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
      {props.items.map((item) => (
        <li key={item.id}>
          <Link className={ratingLinkClassName} href={item.href}>
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function RatingFact(props: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {props.label}
      </dt>
      <dd className="m-0 mt-1 text-sm leading-relaxed text-mit-text">
        {props.value}
      </dd>
    </div>
  );
}

function RatingCatalogItem(props: {
  emptyLabel: string;
  guideLabel: string;
  labels: {
    boats: string;
    classes: string;
    guide: string;
    wind: string;
  };
  levelLabel: string | null;
  rating: PublicSailingRating;
}) {
  const { rating } = props;
  const headingId = `${rating.slug}-heading`;

  return (
    <article
      aria-labelledby={headingId}
      className="scroll-mt-28 border-t border-mit-line py-6 first:border-t-0 first:pt-0"
      id={rating.slug}
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          className="m-0 font-mit-serif text-xl font-semibold tracking-tight text-mit-text md:text-2xl"
          id={headingId}
        >
          {rating.name}
        </h2>
        {props.levelLabel ? (
          <span className="text-sm text-muted-foreground">
            {props.levelLabel}
          </span>
        ) : null}
        {rating.category ? (
          <span className="text-sm text-muted-foreground">
            {rating.category}
          </span>
        ) : null}
      </header>
      <p className="mt-3 mb-0 max-w-3xl text-base leading-relaxed text-pretty text-mit-text">
        {rating.description}
      </p>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RatingFact
          label={props.labels.classes}
          value={
            <RatingFactLinks
              emptyLabel={props.emptyLabel}
              items={rating.grantableClasses.map((sailingClass) => ({
                href: `/classes/${sailingClass.slug}`,
                id: sailingClass.id,
                name: sailingClass.name,
              }))}
            />
          }
        />
        <RatingFact
          label={props.labels.boats}
          value={
            <RatingFactLinks
              emptyLabel={props.emptyLabel}
              items={rating.unlockedBoats.map((boat) => ({
                href: `/fleet/${boat.slug}`,
                id: boat.id,
                name: boat.name,
              }))}
            />
          }
        />
        <RatingFact
          label={props.labels.wind}
          value={rating.windCondition ?? props.emptyLabel}
        />
        <RatingFact
          label={props.labels.guide}
          value={
            rating.guideUrl ? (
              <a
                className={ratingLinkClassName}
                href={rating.guideUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {props.guideLabel}
              </a>
            ) : (
              props.emptyLabel
            )
          }
        />
      </dl>
    </article>
  );
}

/**
 * Public ratings catalog: stacked rating entries that stay readable without
 * horizontal scrolling.
 *
 * @param props - Locale and published ratings
 * @returns Ratings catalog markup
 */
export async function RatingsListView(props: RatingsListViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRatings',
  });

  const activeRatings = props.ratings.filter((rating) => !rating.isDeprecated);
  const deprecatedRatings = props.ratings.filter(
    (rating) => rating.isDeprecated
  );
  const intro = {
    heading: t('list_heading'),
    intro: t('list_intro'),
    staffNote: t('list_staff_note'),
  };

  if (props.ratings.length === 0) {
    return (
      <>
        <RatingPageIntro {...intro} />
        <p className="m-0 max-w-3xl text-base text-mit-text" role="status">
          {t('empty')}
        </p>
      </>
    );
  }

  return (
    <>
      <RatingPageIntro {...intro} />

      {activeRatings.length > 0 ? (
        <div className="min-w-0">
          {activeRatings.map((rating) => (
            <RatingCatalogItem
              emptyLabel={t('not_applicable')}
              guideLabel={t('guide_link')}
              key={rating.id}
              labels={{
                boats: t('column_boats'),
                classes: t('column_classes'),
                guide: t('column_guide'),
                wind: t('column_wind'),
              }}
              levelLabel={
                rating.level ? t('rating_level', { level: rating.level }) : null
              }
              rating={rating}
            />
          ))}
        </div>
      ) : null}

      {deprecatedRatings.length > 0 ? (
        <section
          className={activeRatings.length > 0 ? 'mt-10' : 'mt-0 max-w-3xl'}
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
                {'. '}
                {rating.description}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
