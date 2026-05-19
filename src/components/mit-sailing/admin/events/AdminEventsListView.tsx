import { Plus, Search } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import Form from 'next/form';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminEventListStatusBadge } from '@/components/mit-sailing/admin/events/AdminEventShared';
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
  adminEventDeletePath,
  adminEventEditPath,
  adminEventRegistrationsPath,
  adminEventsIndexPath,
  adminEventsNewPath,
} from '@/libs/admin/events/eventAdminPaths';
import type {
  AdminEventCategoryOption,
  AdminEventDateDto,
  AdminEventListRow,
  AdminEventRegistrationCounts,
} from '@/libs/admin/events/eventAdminQueries';
import { Link } from '@/libs/I18nNavigation';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';

type AdminEventsListTranslations = Awaited<
  ReturnType<typeof getTranslations<'AdminEvents'>>
>;

type AdminEventsListViewProps = {
  categories: AdminEventCategoryOption[];
  /** Localized pathname for the events list GET filter (see `getPathname`). */
  filterAction: string;
  filters: {
    categoryId?: string;
    query?: string;
  };
  rows: AdminEventListRow[];
  t: AdminEventsListTranslations;
};

function firstAndLastDate(dates: AdminEventDateDto[]): {
  first: AdminEventDateDto | null;
  last: AdminEventDateDto | null;
} {
  if (dates.length === 0) {
    return { first: null, last: null };
  }
  const [first, ...rest] = dates.toSorted(
    (a, b) => a.startDateTime.getTime() - b.startDateTime.getTime()
  );
  if (!first) {
    return { first: null, last: null };
  }
  return { first, last: rest.at(-1) ?? first };
}

function dateSummary(
  dates: AdminEventDateDto[],
  t: AdminEventsListTranslations
) {
  const { first, last } = firstAndLastDate(dates);
  if (!first || !last) {
    return t('date_empty');
  }
  if (first.id === last.id) {
    return formatEasternEventRange(first.startDateTime, first.endDateTime);
  }
  return t('date_range_multi', {
    first: formatEasternEventRange(first.startDateTime, first.endDateTime),
    last: formatEasternEventRange(last.startDateTime, last.endDateTime),
  });
}

/**
 * Renders the confirmed-registration column for the admin events table.
 *
 * `capacity === null` means no cap. When set, capacity is at least 1; admin
 * `maxParticipants` is validated by
 * {@link import("@/libs/admin/events/eventAdminSchemas").eventAdminBasicsFormSchema}.
 *
 * Branches before calling `t()` so limited-capacity messages never receive
 * `null` for `capacity`: next-intl 4+ disallows `null` and `undefined` as ICU
 * interpolation values.
 *
 * @param counts - Registration counts for the event
 * @param capacity - Positive cap, or null when uncapped
 * @param t - Admin event list translations
 * @returns Localized registration summary string
 */
function registrationsSummary(
  counts: AdminEventRegistrationCounts,
  capacity: number | null,
  t: AdminEventsListTranslations
) {
  const confirmed =
    capacity === null
      ? t('list_capacity_open', { approved: counts.approved })
      : t('list_capacity_limited', { approved: counts.approved, capacity });
  if (counts.pending === 0) {
    return confirmed;
  }
  return t('list_registration_summary_pending', {
    confirmed,
    pending: counts.pending,
  });
}

function EventStatusBadges(props: {
  event: AdminEventListRow;
  t: AdminEventsListTranslations;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <AdminEventListStatusBadge
        tone={props.event.isPublished ? 'success' : 'neutral'}
      >
        {props.event.isPublished
          ? props.t('status_published')
          : props.t('status_draft')}
      </AdminEventListStatusBadge>
      {props.event.isSpecial ? (
        <AdminEventListStatusBadge tone="danger">
          {props.t('status_special')}
        </AdminEventListStatusBadge>
      ) : null}
      {props.event.detailPageKind === 'external' ? (
        <AdminEventListStatusBadge tone="neutral">
          {props.t('status_external')}
        </AdminEventListStatusBadge>
      ) : null}
    </div>
  );
}

function EventRow(props: {
  event: AdminEventListRow;
  t: AdminEventsListTranslations;
}) {
  return (
    <TableRow>
      <TableCell className="px-4 py-3 align-top text-sm">
        <span className="font-medium text-foreground">
          {props.event.category.name}
        </span>
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            className="font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={adminEventEditPath(props.event.slug)}
          >
            {props.event.name}
          </Link>
          <span className="text-xs text-mit-readable-ink">
            {props.event.shortName} · /events/{props.event.slug}
          </span>
          <EventStatusBadges event={props.event} t={props.t} />
        </div>
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
        {dateSummary(props.event.dates, props.t)}
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm">
        {registrationsSummary(
          props.event.registrationCounts,
          props.event.maxParticipants,
          props.t
        )}
      </TableCell>
      <TableCell className="px-4 py-3 align-top text-sm text-mit-readable-ink">
        {props.event.requiresApproval
          ? props.t('approval_manual')
          : props.t('approval_auto')}
      </TableCell>
      <TableCell className="px-4 py-3 align-top">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={adminEventEditPath(props.event.slug)}
          >
            {props.t('action_edit')}
          </Link>
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={adminEventRegistrationsPath(props.event.slug)}
          >
            {props.t('action_registrations')}
          </Link>
          <Link
            className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={adminEventDeletePath(props.event.slug)}
          >
            {props.t('action_delete')}
          </Link>
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminEventsListView(props: AdminEventsListViewProps) {
  return (
    <div className="flex w-full flex-col gap-6">
      <AdminPageHeader
        actions={
          <Button asChild size="sm" variant="mit">
            <Link href={adminEventsNewPath()}>
              <Plus aria-hidden className="size-4" />
              {props.t('action_new_event')}
            </Link>
          </Button>
        }
        title={props.t('list_title')}
      />

      <Form
        action={props.filterAction}
        className="grid gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)_auto]"
        role="search"
      >
        <label className="relative flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {props.t('filter_search_label')}
          </span>
          <Search
            aria-hidden
            className="pointer-events-none absolute bottom-2 left-2.5 size-4 text-mit-readable-ink"
          />
          <Input
            className="pl-8"
            defaultValue={props.filters.query ?? ''}
            name="q"
            placeholder={props.t('filter_search_placeholder')}
            type="search"
          />
        </label>
        <label className="flex min-w-0 flex-col gap-1.5 text-sm">
          <span className="font-medium text-foreground">
            {props.t('filter_category_label')}
          </span>
          <select
            className={adminNativeSelectClassName}
            defaultValue={props.filters.categoryId ?? ''}
            name="category"
          >
            <option value="">{props.t('filter_category_all')}</option>
            {props.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <Button type="submit" variant="outline">
            {props.t('action_filter')}
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href={adminEventsIndexPath()}>{props.t('action_reset')}</Link>
          </Button>
        </div>
      </Form>

      <p className="text-sm text-mit-readable-ink">
        {props.t('list_count', { count: props.rows.length })}
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <Table className="min-w-[980px] text-left">
            <TableHeader>
              <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                <TableHead className="px-4 py-3">
                  {props.t('column_category')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {props.t('column_event')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {props.t('column_dates')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {props.t('column_registrations')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {props.t('column_approval')}
                </TableHead>
                <TableHead className="px-4 py-3">
                  {props.t('column_actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    className="px-4 py-10 text-center text-sm text-mit-readable-ink"
                    colSpan={6}
                  >
                    {props.t('list_empty')}
                  </TableCell>
                </TableRow>
              ) : (
                props.rows.map((event) => (
                  <EventRow event={event} key={event.id} t={props.t} />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
