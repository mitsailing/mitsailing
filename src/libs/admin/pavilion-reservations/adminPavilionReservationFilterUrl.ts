import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import {
  buildAdminListHref,
  buildAdminListHrefWithoutParam,
} from '@/libs/admin/buildAdminListHref';
import { adminPavilionReservationIndexPath } from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import type {
  AdminPavilionReservationSortDirection,
  AdminPavilionReservationSortKey,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';

export type AdminPavilionReservationListFilters = {
  date?: string;
  direction: AdminPavilionReservationSortDirection;
  paymentStatus?: string;
  search?: string;
  sort: AdminPavilionReservationSortKey;
  status?: string;
  week: string;
};

const adminPavilionDefaultOmit = {
  paymentStatus: '',
  status: '',
} as const;

export function adminPavilionReservationToolbarParams(
  filters: AdminPavilionReservationListFilters
): Record<string, string | undefined> {
  return {
    date: filters.date,
    direction: filters.direction,
    paymentStatus: filters.paymentStatus,
    search: filters.search?.trim() ? filters.search.trim() : undefined,
    sort: filters.sort,
    status: filters.status,
    week: filters.week,
  };
}

export function adminPavilionReservationActiveFilterCount(
  filters: AdminPavilionReservationListFilters
) {
  let count = 0;
  if (filters.status) {
    count += 1;
  }
  if (filters.paymentStatus) {
    count += 1;
  }
  if (filters.date) {
    count += 1;
  }
  if (filters.search?.trim()) {
    count += 1;
  }
  return count;
}

type AdminPavilionReservationFilterChipLabels = {
  chipRemoveAria: (label: string) => string;
  dateLabel: string;
  paymentLabel: string;
  paymentOptions: Record<string, string>;
  searchLabel: string;
  statusLabel: string;
  statusOptions: Record<string, string>;
};

/**
 * Builds removable filter chips for the admin Pavilion reservations list.
 *
 * @param filters - Current list filters including preserved sort/week params
 * @param labels - Localized chip labels
 * @returns Active filter chips
 */
export function adminPavilionReservationFilterChips(
  filters: AdminPavilionReservationListFilters,
  labels: AdminPavilionReservationFilterChipLabels
): AdminFilterChip[] {
  const params = adminPavilionReservationToolbarParams(filters);
  const pathname = adminPavilionReservationIndexPath();
  const chips: AdminFilterChip[] = [];

  if (filters.status) {
    chips.push({
      key: 'status',
      label: labels.statusLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.statusLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPavilionDefaultOmit,
        param: 'status',
        params,
        pathname,
      }),
      valueLabel: labels.statusOptions[filters.status] ?? filters.status,
    });
  }
  if (filters.paymentStatus) {
    chips.push({
      key: 'paymentStatus',
      label: labels.paymentLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.paymentLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPavilionDefaultOmit,
        param: 'paymentStatus',
        params,
        pathname,
      }),
      valueLabel:
        labels.paymentOptions[filters.paymentStatus] ?? filters.paymentStatus,
    });
  }
  if (filters.date) {
    chips.push({
      key: 'date',
      label: labels.dateLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.dateLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPavilionDefaultOmit,
        param: 'date',
        params,
        pathname,
      }),
      valueLabel: filters.date,
    });
  }
  if (filters.search?.trim()) {
    chips.push({
      key: 'search',
      label: labels.searchLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.searchLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPavilionDefaultOmit,
        param: 'search',
        params,
        pathname,
      }),
      valueLabel: filters.search.trim(),
    });
  }

  return chips;
}

export function adminPavilionReservationClearFiltersHref(
  filters: AdminPavilionReservationListFilters
) {
  return buildAdminListHref({
    omitWhenDefault: adminPavilionDefaultOmit,
    params: adminPavilionReservationToolbarParams(filters),
    pathname: adminPavilionReservationIndexPath(),
    updates: {
      date: null,
      paymentStatus: null,
      search: null,
      status: null,
    },
  });
}

export { adminPavilionDefaultOmit };
