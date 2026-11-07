import { Plus } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { AdminActiveFilterChips } from '@/components/mit-sailing/admin/AdminActiveFilterChips';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPagination } from '@/components/mit-sailing/admin/AdminPagination';
import { AdminTableSurface } from '@/components/mit-sailing/admin/AdminTableSurface';
import { AdminUrlFilterToolbar } from '@/components/mit-sailing/admin/AdminUrlFilterToolbar';
import { AdminEventListStatusBadge } from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import {
  adminEventsActiveFilterCount,
  adminEventsClearFiltersHref,
  adminEventsDefaultOmit,
  adminEventsFilterChips,
  adminEventsResolvedFilters,
  adminEventsToolbarParams,
} from '@/libs/admin/events/adminEventsFilterUrl';
import {
  adminEventShowPath,
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
    scope?: string;
  };
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
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

function eventsPaginationSummary(props: {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}) {
  if (props.total === 0) {
    return { end: 0, start: 0 };
  }
  const start = (props.page - 1) * props.pageSize + 1;
  return {
    end: Math.min(props.total, start + props.pageSize - 1),
    start,
  };
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

function EventSummaryField(props: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm break-words text-foreground">
        {props.children}
      </dd>
    </div>
  );
}

function EventRow(props: {
  event: AdminEventListRow;
  t: AdminEventsListTranslations;
}) {
  return (
    <li className="px-4 py-3 md:py-4">
      <article className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-2">
          <Link
            className="text-sm font-semibold break-words text-foreground no-underline hover:underline md:text-base"
            href={adminEventShowPath(props.event.slug)}
          >
            {props.event.name}
          </Link>
          <p className="text-xs text-muted-foreground md:hidden">
            {dateSummary(props.event.dates, props.t)}
            {' · '}
            {registrationsSummary(
              props.event.registrationCounts,
              props.event.maxParticipants,
              props.t
            )}
          </p>
          <div className="hidden flex-wrap items-center gap-x-2 gap-y-1 text-sm text-mit-readable-ink md:flex">
            <span>{props.event.category.name}</span>
            <span aria-hidden>·</span>
            <span>{props.event.shortName}</span>
            <span aria-hidden>·</span>
            <span className="break-all">/events/{props.event.slug}</span>
          </div>
          <EventStatusBadges event={props.event} t={props.t} />
        </div>
        <dl className="hidden min-w-0 gap-3 sm:grid-cols-3 md:grid lg:grid">
          <EventSummaryField label={props.t('column_dates')}>
            {dateSummary(props.event.dates, props.t)}
          </EventSummaryField>
          <EventSummaryField label={props.t('column_registrations')}>
            {registrationsSummary(
              props.event.registrationCounts,
              props.event.maxParticipants,
              props.t
            )}
          </EventSummaryField>
          <EventSummaryField label={props.t('column_approval')}>
            {props.event.requiresApproval
              ? props.t('approval_manual')
              : props.t('approval_auto')}
          </EventSummaryField>
        </dl>
      </article>
    </li>
  );
}

export function AdminEventsListView(props: AdminEventsListViewProps) {
  const resolvedFilters = adminEventsResolvedFilters(props.filters);
  const pagination = props.pagination ?? {
    page: 1,
    pageSize: Math.max(props.rows.length, 1),
    total: props.rows.length,
  };
  const range = eventsPaginationSummary(pagination);
  const hasActiveFilters = adminEventsActiveFilterCount(props.filters) > 0;
  const chipLabels = {
    categoryAll: props.t('filter_category_all'),
    categoryLabel: props.t('filter_category_label'),
    chipRemoveAria: (label: string) =>
      props.t('filter_chip_remove_aria', { label }),
    scopeAll: props.t('filter_scope_all'),
    scopeLabel: props.t('filter_scope_label'),
    scopeMy: props.t('filter_scope_my'),
    searchLabel: props.t('filter_search_label'),
  };
  const filterChips = adminEventsFilterChips(
    props.filters,
    props.categories,
    chipLabels
  );

  return (
    <div className="flex w-full flex-col gap-4">
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

      <AdminUrlFilterToolbar
        basePath={props.filterAction}
        omitWhenDefault={adminEventsDefaultOmit}
        params={adminEventsToolbarParams(props.filters)}
        search={{
          label: props.t('filter_search_label'),
          param: 'q',
          placeholder: props.t('filter_search_placeholder'),
          value: resolvedFilters.query,
        }}
        selects={[
          {
            defaultValue: 'my',
            label: props.t('filter_scope_label'),
            options: [
              { label: props.t('filter_scope_my'), value: 'my' },
              { label: props.t('filter_scope_all'), value: 'all' },
            ],
            param: 'scope',
            value: resolvedFilters.scope,
          },
          {
            defaultValue: '',
            label: props.t('filter_category_label'),
            options: [
              { label: props.t('filter_category_all'), value: '' },
              ...props.categories.map((category) => ({
                label: category.name,
                value: category.id,
              })),
            ],
            param: 'category',
            value: resolvedFilters.categoryId,
          },
        ]}
      />
      <AdminActiveFilterChips
        chips={filterChips}
        clearHref={
          hasActiveFilters
            ? adminEventsClearFiltersHref(props.filters)
            : undefined
        }
        clearLabel={hasActiveFilters ? props.t('action_reset') : undefined}
      />

      <p className="text-sm text-mit-readable-ink">
        {props.t('list_count', { count: pagination.total })}
      </p>

      <AdminTableSurface
        footer={
          <AdminPagination
            basePath={adminEventsIndexPath()}
            labels={{
              next: props.t('pagination_next'),
              previous: props.t('pagination_previous'),
              summary: props.t('pagination_summary', {
                end: range.end,
                start: range.start,
                total: pagination.total,
              }),
            }}
            page={pagination.page}
            pageSize={pagination.pageSize}
            params={{
              category: props.filters.categoryId,
              q: props.filters.query,
              scope: props.filters.scope,
            }}
            total={pagination.total}
          />
        }
      >
        <ul
          aria-label={props.t('list_title')}
          className="m-0 list-none divide-y divide-border p-0"
        >
          {props.rows.length === 0 ? (
            <li className="px-4 py-10 text-center text-sm text-mit-readable-ink">
              {props.t('list_empty')}
            </li>
          ) : (
            props.rows.map((event) => (
              <EventRow event={event} key={event.id} t={props.t} />
            ))
          )}
        </ul>
      </AdminTableSurface>
    </div>
  );
}
