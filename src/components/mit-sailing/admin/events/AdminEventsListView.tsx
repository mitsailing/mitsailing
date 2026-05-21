import { Plus, Search } from 'lucide-react';
import type { getTranslations } from 'next-intl/server';
import Form from 'next/form';
import type * as React from 'react';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminEventListStatusBadge } from '@/components/mit-sailing/admin/events/AdminEventShared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { adminNativeSelectClassName } from '@/lib/mit-sailing/tokens';
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
import { adminEventListScopeFromValue } from '@/libs/admin/events/eventAdminQueries';
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

function resetFiltersPath(scope: 'all' | 'my'): string {
  if (scope === 'all') {
    return `${adminEventsIndexPath()}?scope=all`;
  }
  return adminEventsIndexPath();
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
      <dt className="text-xs font-semibold tracking-wide text-mit-readable-ink uppercase">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm break-words text-mit-readable-ink">
        {props.children}
      </dd>
    </div>
  );
}

function EventCard(props: {
  event: AdminEventListRow;
  t: AdminEventsListTranslations;
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <article className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-2">
          <span className="text-xs font-medium text-mit-readable-ink uppercase">
            {props.event.category.name}
          </span>
          <Link
            className="font-semibold break-words text-mit-red no-underline hover:underline dark:text-mit-red-ink"
            href={adminEventShowPath(props.event.slug)}
          >
            {props.event.name}
          </Link>
          <span className="text-xs break-words text-mit-readable-ink">
            {props.event.shortName} · /events/{props.event.slug}
          </span>
          <EventStatusBadges event={props.event} t={props.t} />
        </div>
        <dl className="grid min-w-0 gap-3 sm:grid-cols-3 lg:grid-cols-1">
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
  const scope = adminEventListScopeFromValue(props.filters.scope);
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
        className="grid gap-3 rounded-lg border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_minmax(160px,220px)_minmax(220px,280px)_auto]"
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
            {props.t('filter_scope_label')}
          </span>
          <select
            className={adminNativeSelectClassName}
            defaultValue={scope}
            name="scope"
          >
            <option value="my">{props.t('filter_scope_my')}</option>
            <option value="all">{props.t('filter_scope_all')}</option>
          </select>
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
            <Link href={resetFiltersPath(scope)}>
              {props.t('action_reset')}
            </Link>
          </Button>
        </div>
      </Form>

      <p className="text-sm text-mit-readable-ink">
        {props.t('list_count', { count: props.rows.length })}
      </p>

      <ul
        aria-label={props.t('list_title')}
        className="m-0 grid list-none gap-3 p-0"
      >
        {props.rows.length === 0 ? (
          <li className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-mit-readable-ink">
            {props.t('list_empty')}
          </li>
        ) : (
          props.rows.map((event) => (
            <EventCard event={event} key={event.id} t={props.t} />
          ))
        )}
      </ul>
    </div>
  );
}
