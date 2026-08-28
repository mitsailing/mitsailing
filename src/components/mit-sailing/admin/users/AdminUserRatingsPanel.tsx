import { getFormatter, getTranslations } from 'next-intl/server';
import { SubmitButton } from '@/components/ui/submit-button';
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
  canAssignRatings: boolean;
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
    <section className="flex flex-col gap-3">
      <div>
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
          {props.rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="px-3 py-4 text-sm text-muted-foreground"
                colSpan={4}
              >
                {t('ratings_empty')}
              </TableCell>
            </TableRow>
          ) : null}
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
            let ratingAction = null;
            if (props.canAssignRatings && row.issuedAt) {
              ratingAction = (
                <form action={revokeAction}>
                  <input name="sailingRatingId" type="hidden" value={row.id} />
                  <SubmitButton
                    pendingKind="submitting"
                    size="sm"
                    variant="outline"
                  >
                    {t('rating_action_revoke')}
                  </SubmitButton>
                </form>
              );
            } else if (props.canAssignRatings) {
              ratingAction = (
                <form action={grantAction}>
                  <input name="sailingRatingId" type="hidden" value={row.id} />
                  <SubmitButton
                    aria-describedby={
                      grantDisabledMessage ? grantDisabledMessageId : undefined
                    }
                    disabled={!row.eligibility.eligible}
                    pendingKind="adding"
                    size="sm"
                  >
                    {t('rating_action_grant')}
                  </SubmitButton>
                  {grantDisabledMessage ? (
                    <p
                      className="mt-1 mb-0 text-xs text-muted-foreground"
                      id={grantDisabledMessageId}
                    >
                      {grantDisabledMessage}
                    </p>
                  ) : null}
                </form>
              );
            }

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
                <TableCell>{ratingAction}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </section>
  );
}
