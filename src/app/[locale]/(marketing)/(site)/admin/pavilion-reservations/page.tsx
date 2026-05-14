import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
import {
  adminPavilionReservationDetailPath,
  adminPavilionReservationIndexPath,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import {
  adminPavilionReservationStatuses,
  listAdminPavilionReservationRows,
  parseAdminPavilionReservationStatus,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import { Link } from '@/libs/I18nNavigation';
import { formatPavilionReservationMoney } from '@/libs/mit-sailing/pavilionReservationPricing';

type AdminPavilionReservationsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string | string[] }>;
};

export async function generateMetadata(
  props: AdminPavilionReservationsPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_admin_pavilion_reservations') };
}

export default async function AdminPavilionReservationsPage(
  props: AdminPavilionReservationsPageProps
) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const status = parseAdminPavilionReservationStatus(searchParams.status);
  const [rows, t] = await Promise.all([
    listAdminPavilionReservationRows({ status }),
    getTranslations({ locale, namespace: 'AdminPavilionReservations' }),
  ]);

  return (
    <div className="flex w-full flex-col gap-6">
      <AdminPageHeader title={t('list_title')} />

      <form
        action=""
        className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(220px,320px)_auto_1fr]"
      >
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {t('filter_status_label')}
          </span>
          <select
            className={adminNativeSelectClassName}
            defaultValue={status ?? ''}
            name="status"
          >
            <option value="">{t('filter_status_all')}</option>
            {adminPavilionReservationStatuses.map((statusOption) => (
              <option key={statusOption} value={statusOption}>
                {t(`status_${statusOption}`)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="outline">
            {t('action_filter')}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={adminPavilionReservationIndexPath()}>
              {t('action_reset')}
            </Link>
          </Button>
        </div>
      </form>

      <p className="text-sm text-mit-readable-ink">
        {t('list_count', { count: rows.length })}
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px] text-left">
            <TableHeader>
              <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 py-3">
                  {t('column_reference')}
                </TableHead>
                <TableHead className="px-4 py-3">{t('column_event')}</TableHead>
                <TableHead className="px-4 py-3">
                  {t('column_requester')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {t('column_status')}
                </TableHead>
                <TableHead className="px-4 py-3">{t('column_items')}</TableHead>
                <TableHead className="px-4 py-3">
                  {t('column_estimate')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {t('column_actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-4 py-10 text-center text-sm text-mit-readable-ink"
                    colSpan={7}
                  >
                    {t('list_empty')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="px-4 py-3 align-top font-mono text-sm">
                      {row.referenceCode}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <div className="font-semibold text-mit-text">
                        {row.eventName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t(`persona_${row.persona}`)}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      <div className="font-medium text-mit-text">
                        {row.firstName} {row.lastName}
                      </div>
                      <div className="text-muted-foreground">
                        {row.requesterEmail}
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {t(`status_${row.status}`)}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
                      {t('items_summary', {
                        services: row.serviceCount,
                        slots: row.slotCount,
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {row.estimatedTotalCents === null
                        ? t('price_tbd')
                        : formatPavilionReservationMoney(
                            row.estimatedTotalCents
                          )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top">
                      <Link
                        className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                        href={adminPavilionReservationDetailPath(row.id)}
                      >
                        {t('action_view')}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
