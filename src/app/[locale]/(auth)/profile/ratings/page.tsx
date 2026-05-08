import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { requireCurrentUser } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { listProfileSailingRatingRows } from '@/libs/mit-sailing/sailingRatingQueries';
import { getI18nPath } from '@/utils/Helpers';

type ProfileRatingsPageProps = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata(
  props: ProfileRatingsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  return {
    title: t('ratings_meta_title'),
    description: t('ratings_meta_description'),
  };
}

export default async function ProfileRatingsPage(
  props: ProfileRatingsPageProps
) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const user = await requireCurrentUser(
    locale,
    getI18nPath('/profile/ratings/', locale)
  );
  const rows = await listProfileSailingRatingRows(user.id);
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 font-mit-serif text-2xl font-semibold text-mit-text">
        {t('ratings_page_heading')}
      </h1>
      {rows.length === 0 ? (
        <p className="rounded-lg border border-mit-line bg-card p-5 text-sm text-mit-text">
          {t('ratings_empty')}
        </p>
      ) : (
        <ul className="m-0 list-none space-y-4 p-0">
          {rows.map((rating) => (
            <li
              className="rounded-lg border border-mit-line bg-card p-5"
              key={rating.id}
            >
              <h2 className="mb-2 font-mit-serif text-xl font-semibold text-mit-text">
                {rating.name}
              </h2>
              <p className="mb-3 text-sm text-mit-text">
                {t('ratings_issued', {
                  date: dateFormatter.format(rating.issuedAt),
                })}
                {' · '}
                {t('ratings_issued_by', { name: rating.issuedByName })}
              </p>
              {rating.unlockedBoats.length > 0 ? (
                <div>
                  <h3 className="mb-2 text-xs font-semibold tracking-wide text-mit-text uppercase">
                    {t('ratings_unlocked_boats')}
                  </h3>
                  <ul className="m-0 list-none space-y-1 p-0">
                    {rating.unlockedBoats.map((boat) => (
                      <li key={boat.id}>
                        <Link
                          className={`text-sm font-semibold text-mit-red-ink hover:underline ${textFocusRingClassName}`}
                          href={`/fleet/${boat.slug}/`}
                        >
                          {boat.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
