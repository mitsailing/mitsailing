import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { EVENTS_TIME_ZONE } from '@/lib/mit-sailing/nyTime';
import { requireCurrentUser } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
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
    getI18nPath('/profile/ratings', locale)
  );
  const rows = await listUserRatingAssignmentRows(user.id, {
    includeDeprecated: false,
  });
  const t = await getTranslations({ locale, namespace: 'UserProfilePage' });
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: EVENTS_TIME_ZONE,
  });

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="mb-8 font-mit-serif text-3xl font-semibold text-mit-text">
        {t('ratings_page_heading')}
      </h1>
      <table className="w-full table-fixed border-collapse text-left text-sm leading-snug text-mit-text md:text-base">
        <thead>
          <tr className="text-sm font-bold text-mit-text">
            <th className="w-[42%] px-2 py-2" scope="col">
              {t('ratings_column_rating')}
            </th>
            <th className="w-[58%] px-2 py-2" scope="col">
              {t('ratings_column_assignment')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr className="border-t border-mit-line">
              <td
                className="text-mit-text-secondary px-2 py-4 text-center"
                colSpan={2}
              >
                {t('ratings_empty_state')}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr className="border-t border-mit-line" key={row.id}>
                <th className="px-2 py-2 font-normal" scope="row">
                  {row.name}
                </th>
                <td className="px-2 py-2">
                  {row.issuedAt && row.issuedByName
                    ? t('ratings_issued_by', {
                        date: dateFormatter.format(row.issuedAt),
                        name: row.issuedByName,
                      })
                    : null}
                  {row.issuedAt && !row.issuedByName
                    ? t('ratings_issued_on', {
                        date: dateFormatter.format(row.issuedAt),
                      })
                    : null}
                  {row.issuedAt ? null : (
                    <span className="text-mit-text-secondary">
                      {t('ratings_no_issue_date')}
                    </span>
                  )}
                  {row.unlockedBoats.length > 0 ? (
                    <ul className="mt-2 mb-0 list-disc space-y-1 pl-5">
                      {row.unlockedBoats.map((boat) => (
                        <li key={boat.id}>
                          <Link
                            className="font-semibold text-mit-red hover:underline dark:text-mit-red-ink"
                            href={`/fleet/${boat.slug}`}
                          >
                            {boat.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </section>
  );
}
