import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type {
  AdminPavilionReservationSortDirection,
  AdminPavilionReservationSortKey,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import {
  adminPavilionReservationStatuses,
  listAdminPavilionReservationRows,
  parseAdminPavilionReservationDateFilter,
  parseAdminPavilionReservationSearch,
  parseAdminPavilionReservationSortDirection,
  parseAdminPavilionReservationSortKey,
  parseAdminPavilionReservationStatus,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import {
  adminPavilionReservationAddDays,
  adminPavilionReservationDateKey,
  adminPavilionReservationWeekKeys,
  adminPavilionReservationWeekStart,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminSchedule';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternShortDateFromIsoCalendar } from '@/libs/mit-sailing/easternTimeFormat';
import { formatPavilionReservationMoney } from '@/libs/mit-sailing/pavilionReservationPricing';
import { formatPavilionReservationTimeLabel } from '@/libs/mit-sailing/pavilionReservationTimeLabel';

type AdminPavilionReservationsPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    date?: string | string[];
    direction?: string | string[];
    search?: string | string[];
    sort?: string | string[];
    status?: string | string[];
    week?: string | string[];
  }>;
};

function filterHref(params: {
  date?: string;
  direction?: AdminPavilionReservationSortDirection;
  search?: string;
  sort?: AdminPavilionReservationSortKey;
  status?: string;
  week?: string;
}) {
  const searchParams = new URLSearchParams();
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.date) {
    searchParams.set('date', params.date);
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }
  if (params.sort) {
    searchParams.set('sort', params.sort);
  }
  if (params.direction) {
    searchParams.set('direction', params.direction);
  }
  if (params.week) {
    searchParams.set('week', params.week);
  }
  const query = searchParams.toString();
  return query
    ? `${adminPavilionReservationIndexPath()}?${query}`
    : adminPavilionReservationIndexPath();
}

function firstSlotLabel(props: {
  date: Date | null;
  startMinutes: number | null;
  blank: string;
}) {
  if (!props.date || props.startMinutes === null) {
    return props.blank;
  }
  return `${formatEasternShortDateFromIsoCalendar(
    adminPavilionReservationDateKey(props.date)
  )} ${formatPavilionReservationTimeLabel(props.startMinutes)}`;
}

function nextDirection(
  key: AdminPavilionReservationSortKey,
  current: AdminPavilionReservationSortKey,
  direction: AdminPavilionReservationSortDirection
): AdminPavilionReservationSortDirection {
  return key === current && direction === 'asc' ? 'desc' : 'asc';
}

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
  const date = parseAdminPavilionReservationDateFilter(searchParams.date);
  const search = parseAdminPavilionReservationSearch(searchParams.search);
  const sort = parseAdminPavilionReservationSortKey(searchParams.sort);
  const direction = parseAdminPavilionReservationSortDirection(
    searchParams.direction
  );
  const weekStart = adminPavilionReservationWeekStart(
    parseAdminPavilionReservationDateFilter(searchParams.week) ??
      date ??
      adminPavilionReservationDateKey(new Date())
  );
  const weekKeys = adminPavilionReservationWeekKeys(weekStart);
  const [result, t] = await Promise.all([
    listAdminPavilionReservationRows(
      { date, direction, search, sort, status },
      weekKeys
    ),
    getTranslations({ locale, namespace: 'AdminPavilionReservations' }),
  ]);

  const commonHrefParams = { date, direction, search, status, week: weekStart };

  return (
    <div className="flex w-full flex-col gap-6">
      <AdminPageHeader title={t('list_title')} />

      <form
        action={adminPavilionReservationIndexPath()}
        className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(180px,240px)_minmax(180px,240px)_minmax(220px,1fr)_auto]"
      >
        <input name="sort" type="hidden" value={sort} />
        <input name="direction" type="hidden" value={direction} />
        <input name="week" type="hidden" value={weekStart} />
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
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {t('filter_date_label')}
          </span>
          <Input defaultValue={date ?? ''} name="date" type="date" />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {t('filter_search_label')}
          </span>
          <Input
            defaultValue={search ?? ''}
            name="search"
            placeholder={t('filter_search_placeholder')}
            type="search"
          />
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

      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-mit-text">
              {t('calendar_title')}
            </h2>
            <p className="text-sm text-mit-readable-ink">
              {t('calendar_week_label', {
                end: formatEasternShortDateFromIsoCalendar(
                  weekKeys[6] ?? weekStart
                ),
                start: formatEasternShortDateFromIsoCalendar(weekStart),
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                href={filterHref({
                  ...commonHrefParams,
                  week: adminPavilionReservationAddDays(weekStart, -7),
                })}
              >
                {t('calendar_previous_week')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={filterHref({
                  ...commonHrefParams,
                  week: adminPavilionReservationWeekStart(
                    adminPavilionReservationDateKey(new Date())
                  ),
                })}
              >
                {t('calendar_current_week')}
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link
                href={filterHref({
                  ...commonHrefParams,
                  week: adminPavilionReservationAddDays(weekStart, 7),
                })}
              >
                {t('calendar_next_week')}
              </Link>
            </Button>
          </div>
        </div>
        <div className="mt-4 grid min-w-0 gap-2 md:grid-cols-7">
          {weekKeys.map((dateKey) => (
            <div
              className="min-h-32 rounded-md border border-border bg-background p-2"
              key={dateKey}
            >
              <div className="text-xs font-semibold text-muted-foreground">
                {formatEasternShortDateFromIsoCalendar(dateKey)}
              </div>
              <div className="mt-2 space-y-2">
                {result.calendarSegments.filter(
                  (segment) => segment.dateKey === dateKey
                ).length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {t('calendar_empty_day')}
                  </p>
                ) : (
                  result.calendarSegments
                    .filter((segment) => segment.dateKey === dateKey)
                    .map((segment) => (
                      <Link
                        className="block rounded-md bg-muted p-2 text-xs no-underline hover:bg-muted/70"
                        href={adminPavilionReservationDetailPath(
                          segment.requestId
                        )}
                        key={segment.id}
                      >
                        <span className="block font-semibold text-mit-text">
                          {formatPavilionReservationTimeLabel(
                            segment.startMinutes
                          )}{' '}
                          -{' '}
                          {formatPavilionReservationTimeLabel(
                            segment.endMinutes
                          )}
                        </span>
                        <span className="block text-mit-readable-ink">
                          {segment.itemName}
                        </span>
                        <span className="block truncate text-muted-foreground">
                          {segment.eventName}
                        </span>
                      </Link>
                    ))
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-mit-readable-ink">
        {t('list_count', { count: result.rows.length })}
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[1100px] text-left">
            <TableHeader>
              <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 py-3">
                  {t('column_reference')}
                </TableHead>
                {(
                  [
                    ['eventName', 'column_event'],
                    ['requester', 'column_requester'],
                    ['status', 'column_status'],
                    ['firstSlot', 'column_first_slot'],
                    ['estimate', 'column_estimate'],
                    ['paymentStatus', 'column_payment'],
                  ] as const
                ).map(([sortKey, labelKey]) => (
                  <TableHead className="px-4 py-3" key={sortKey}>
                    <Link
                      className="font-medium text-foreground no-underline hover:underline"
                      href={filterHref({
                        ...commonHrefParams,
                        direction: nextDirection(sortKey, sort, direction),
                        sort: sortKey,
                      })}
                    >
                      {t(labelKey)}
                    </Link>
                  </TableHead>
                ))}
                <TableHead className="px-4 py-3">
                  {t('column_conflicts')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {t('column_actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-4 py-10 text-center text-sm text-mit-readable-ink"
                    colSpan={9}
                  >
                    {t('list_empty')}
                  </TableCell>
                </TableRow>
              ) : (
                result.rows.map((row) => (
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
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {firstSlotLabel({
                        blank: t('blank'),
                        date: row.firstSlotDate,
                        startMinutes: row.firstSlotStartMinutes,
                      })}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {row.estimatedTotalCents === null
                        ? t('price_tbd')
                        : formatPavilionReservationMoney(
                            row.estimatedTotalCents
                          )}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {t(`payment_${row.paymentStatus}`)}
                    </TableCell>
                    <TableCell className="px-4 py-3 align-top text-sm">
                      {row.conflictSeverity
                        ? t(`conflict_${row.conflictSeverity}`)
                        : t('conflict_none')}
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
