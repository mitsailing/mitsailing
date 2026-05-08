import { getTranslations } from 'next-intl/server';
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
import type { AdminUserRatingRow } from '@/libs/mit-sailing/sailingRatingQueries';

type AdminUserRatingsPanelProps = {
  locale: string;
  userId: string;
  rows: AdminUserRatingRow[];
  errorCode?: string | null;
};

export async function AdminUserRatingsPanel(props: AdminUserRatingsPanelProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'AdminUsers',
  });
  const grantAction = grantAdminUserRatingAction.bind(
    null,
    props.locale,
    props.userId
  );
  const revokeAction = revokeAdminUserRatingAction.bind(
    null,
    props.locale,
    props.userId
  );
  let error: string | null = null;
  if (props.errorCode === 'missing_prerequisites') {
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
          <p className="mt-2 mb-0 text-sm text-red-700" role="alert">
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
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <div className="font-semibold text-foreground">{row.name}</div>
                {row.isDeprecated ? (
                  <div className="text-xs text-muted-foreground">
                    {t('rating_status_deprecated')}
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                {row.issuedAt
                  ? new Intl.DateTimeFormat(props.locale, {
                      dateStyle: 'medium',
                    }).format(row.issuedAt)
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
                      disabled={!row.eligibility.eligible}
                      size="sm"
                      type="submit"
                    >
                      {t('rating_action_grant')}
                    </Button>
                  </form>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
