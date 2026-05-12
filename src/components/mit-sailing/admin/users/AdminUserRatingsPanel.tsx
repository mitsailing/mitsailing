import { getFormatter, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  grantAdminUserRatingAction,
  revokeAdminUserRatingAction,
} from '@/libs/admin/users/adminUserRatingActions';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

/** Props for {@link AdminUserRatingsPanel}. */
type AdminUserRatingsPanelProps = {
  locale: string;
  userId: string;
  rows: UserRatingAssignmentRow[];
  errorCode?: string | null;
  ratingsLoadFailed?: boolean;
};

/**
 * Renders admin controls for granting and revoking sailing ratings.
 *
 * @param props - User rating rows and mutation context, including optional
 *   `ratingsLoadFailed` when the parent failed to load rows from the database.
 * @returns Ratings admin table.
 */
export async function AdminUserRatingsPanel(props: AdminUserRatingsPanelProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminUsers',
  });
  const format = await getFormatter({ locale: props.locale });
  const actionProps = { locale: props.locale, userId: props.userId };
  const grantAction = grantAdminUserRatingAction.bind(null, actionProps);
  const revokeAction = revokeAdminUserRatingAction.bind(null, actionProps);
  let error: string | null = null;
  if (props.ratingsLoadFailed) {
    error = t('rating_load_failed');
  } else if (props.errorCode === 'missing_prerequisites') {
    error = t('rating_error_missing_prerequisites');
  } else if (props.errorCode === 'already_granted') {
    error = t('rating_error_already_granted');
  } else if (props.errorCode === 'deprecated') {
    error = t('rating_error_deprecated');
  } else if (props.errorCode) {
    error = t('rating_error_unknown');
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-5 py-4">
        <h2 className="m-0 text-lg font-semibold text-foreground">
          {t('ratings_heading')}
        </h2>
        {error ? (
          <p className="mt-2 mb-0 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('rating_column_rating')}</TableHead>
            <TableHead>{t('rating_column_date')}</TableHead>
            <TableHead>{t('rating_column_issued_by')}</TableHead>
            <TableHead>{t('column_actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => {
            let grantDisabledMessage: string | null = null;
            if (!row.eligibility.eligible) {
              if (row.eligibility.reason === 'missing_prerequisites') {
                grantDisabledMessage = t(
                  'rating_grant_disabled_missing_prerequisites'
                );
              } else if (row.eligibility.reason === 'deprecated') {
                grantDisabledMessage = t('rating_grant_disabled_deprecated');
              } else {
                grantDisabledMessage = t(
                  'rating_grant_disabled_already_granted'
                );
              }
            }
            const grantDisabledMessageId = `${row.id}-grant-disabled`;

            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-semibold text-foreground">
                    {row.name}
                  </div>
                  {row.isDeprecated ? (
                    <div className="text-xs text-muted-foreground">
                      {t('rating_status_deprecated')}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell>
                  {row.issuedAt
                    ? format.dateTime(row.issuedAt, { dateStyle: 'medium' })
                    : t('rating_status_missing')}
                </TableCell>
                <TableCell>{row.issuedByName ?? '—'}</TableCell>
                <TableCell>
                  {row.issuedAt ? (
                    <form action={revokeAction}>
                      <input
                        name="sailingRatingId"
                        type="hidden"
                        value={row.id}
                      />
                      <Button size="sm" type="submit" variant="outline">
                        {t('rating_action_revoke')}
                      </Button>
                    </form>
                  ) : (
                    <form action={grantAction}>
                      <input
                        name="sailingRatingId"
                        type="hidden"
                        value={row.id}
                      />
                      <Button
                        aria-describedby={
                          grantDisabledMessage
                            ? grantDisabledMessageId
                            : undefined
                        }
                        disabled={!row.eligibility.eligible}
                        size="sm"
                        type="submit"
                      >
                        {t('rating_action_grant')}
                      </Button>
                      {grantDisabledMessage ? (
                        <p
                          className="mt-1 mb-0 text-xs text-muted-foreground"
                          id={grantDisabledMessageId}
                        >
                          {grantDisabledMessage}
                        </p>
                      ) : null}
                    </form>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
