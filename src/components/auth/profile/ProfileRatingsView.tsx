import { ArrowRight, Check } from 'lucide-react';
import type { getFormatter, getTranslations } from 'next-intl/server';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

type ProfileRatingsTranslations = Awaited<
  ReturnType<typeof getTranslations<'UserProfilePage'>>
>;

type ProfileRatingsFormatter = Awaited<ReturnType<typeof getFormatter>>;

type ProfileRatingsViewProps = {
  format: ProfileRatingsFormatter;
  rows: UserRatingAssignmentRow[];
  t: ProfileRatingsTranslations;
};

function grantedCount(rows: readonly UserRatingAssignmentRow[]): number {
  return rows.filter((row) => row.issuedAt !== null).length;
}

function ProfileRatingsMobileLabel(props: { readonly label: string }) {
  return (
    <p className="m-0 text-xs font-medium text-mit-readable-ink md:hidden">
      {props.label}
    </p>
  );
}

function ProfileRatingStatus(props: {
  readonly granted: boolean;
  readonly t: ProfileRatingsTranslations;
}) {
  if (props.granted) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mit-success-ink">
        <Check aria-hidden className="size-4 shrink-0" />
        {props.t('ratings_status_earned')}
      </span>
    );
  }

  return (
    <span className="text-sm text-mit-readable-ink">
      {props.t('ratings_status_not_earned')}
    </span>
  );
}

function ProfileRatingIssuedCell(props: {
  format: ProfileRatingsFormatter;
  row: UserRatingAssignmentRow;
  t: ProfileRatingsTranslations;
}) {
  if (props.row.issuedAt) {
    const issuedDate = props.format.dateTime(props.row.issuedAt, {
      dateStyle: 'medium',
    });

    return (
      <div className="space-y-1">
        <p className="m-0 text-sm text-mit-text">
          {props.row.issuedByName
            ? props.t('ratings_issued_by', {
                date: issuedDate,
                name: props.row.issuedByName,
              })
            : props.t('ratings_issued_on', { date: issuedDate })}
        </p>
        {props.row.unlockedBoats.length > 0 ? (
          <p className="m-0 text-xs text-mit-readable-ink">
            {props.t('ratings_unlocked_boats')}{' '}
            {props.row.unlockedBoats.map((boat, index) => (
              <span key={boat.id}>
                {index > 0 ? ', ' : null}
                <Link
                  className={`font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
                  href={`/fleet/${boat.slug}`}
                >
                  {boat.name}
                </Link>
              </span>
            ))}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <span className="text-sm text-mit-readable-ink" aria-hidden="true">
      —
    </span>
  );
}

function ProfileRatingRow(props: {
  format: ProfileRatingsFormatter;
  row: UserRatingAssignmentRow;
  t: ProfileRatingsTranslations;
}) {
  const granted = props.row.issuedAt !== null;

  return (
    <tr className="border-t border-mit-line align-top">
      <th className="px-2 py-4 font-normal md:px-0" scope="row">
        <Link
          className={`font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
          href={`/ratings#${props.row.slug}`}
        >
          {props.row.name}
        </Link>
        {props.row.category ? (
          <p className="mt-1 mb-0 text-xs text-mit-readable-ink">
            {props.row.category}
          </p>
        ) : null}
      </th>
      <td className="px-2 py-4 md:px-0">
        <ProfileRatingsMobileLabel label={props.t('ratings_column_status')} />
        <ProfileRatingStatus granted={granted} t={props.t} />
      </td>
      <td className="px-2 py-4 md:px-0">
        <ProfileRatingsMobileLabel label={props.t('ratings_column_issued')} />
        <ProfileRatingIssuedCell
          format={props.format}
          row={props.row}
          t={props.t}
        />
      </td>
    </tr>
  );
}

export function ProfileRatingsView(props: ProfileRatingsViewProps) {
  const earnedCount = grantedCount(props.rows);

  return (
    <section className="mx-auto max-w-5xl">
      <h1 className="mb-2 font-mit-serif text-3xl font-semibold text-mit-text">
        {props.t('ratings_page_heading')}
      </h1>
      <p className="mb-2 text-sm text-mit-readable-ink">
        {props.t('ratings_page_intro')}
      </p>
      {props.rows.length > 0 ? (
        <p className="mb-6 text-sm font-medium text-mit-text">
          {props.t('ratings_summary', {
            granted: earnedCount,
            total: props.rows.length,
          })}
        </p>
      ) : (
        <p className="mb-6 text-sm text-mit-readable-ink" role="status">
          {props.t('ratings_empty_state')}
        </p>
      )}
      {props.rows.length > 0 ? (
        <div className="overflow-x-auto border-y border-mit-line text-sm leading-snug text-mit-text">
          <table className="w-full min-w-[640px] table-fixed border-collapse text-left">
            <thead>
              <tr className="border-b border-mit-line text-xs font-medium text-mit-readable-ink">
                <th className="w-[38%] py-2 pr-4" scope="col">
                  {props.t('ratings_column_rating')}
                </th>
                <th className="w-[22%] py-2 pr-4" scope="col">
                  {props.t('ratings_column_status')}
                </th>
                <th className="w-[40%] py-2" scope="col">
                  {props.t('ratings_column_issued')}
                </th>
              </tr>
            </thead>
            <tbody>
              {props.rows.map((row) => (
                <ProfileRatingRow
                  format={props.format}
                  key={row.id}
                  row={row}
                  t={props.t}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="mt-6 text-sm text-mit-readable-ink">
        <Link
          className={`inline-flex items-center gap-1 font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`}
          href="/ratings"
        >
          {props.t('ratings_explore_link')}
          <ArrowRight aria-hidden className="size-3.5 shrink-0" />
        </Link>
      </p>
    </section>
  );
}
