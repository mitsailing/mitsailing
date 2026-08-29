import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import { buildAdminListHrefWithoutParam } from '@/libs/admin/buildAdminListHref';
import type {
  AdminPaymentLedgerFilters,
  AdminPaymentLedgerRow,
} from '@/libs/admin/payments/adminPaymentQueries';

const adminPaymentsBasePath = '/admin/payments';

const adminPaymentsDefaultOmit = {
  status: 'all',
} as const;

export function adminPaymentsToolbarParams(
  filters: AdminPaymentLedgerFilters
): Record<string, string | undefined> {
  return {
    q: filters.query?.trim() ? filters.query.trim() : undefined,
    status:
      filters.status && filters.status !== 'all' ? filters.status : undefined,
  };
}

export function adminPaymentsActiveFilterCount(
  filters: AdminPaymentLedgerFilters
) {
  let count = 0;
  if (filters.query?.trim()) {
    count += 1;
  }
  if (filters.status && filters.status !== 'all') {
    count += 1;
  }
  return count;
}

type AdminPaymentsFilterChipLabels = {
  chipRemoveAria: (label: string) => string;
  searchLabel: string;
  statusLabel: string;
  statusLabels: Record<AdminPaymentLedgerRow['status'], string>;
};

/**
 * Builds removable filter chips for the admin payments ledger.
 *
 * @param filters - Current ledger filters
 * @param labels - Localized chip labels
 * @returns Active filter chips
 */
export function adminPaymentsFilterChips(
  filters: AdminPaymentLedgerFilters,
  labels: AdminPaymentsFilterChipLabels
): AdminFilterChip[] {
  const params = adminPaymentsToolbarParams(filters);
  const chips: AdminFilterChip[] = [];

  if (filters.query?.trim()) {
    chips.push({
      key: 'q',
      label: labels.searchLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.searchLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPaymentsDefaultOmit,
        param: 'q',
        params,
        pathname: adminPaymentsBasePath,
      }),
      valueLabel: filters.query.trim(),
    });
  }
  if (filters.status && filters.status !== 'all') {
    chips.push({
      key: 'status',
      label: labels.statusLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.statusLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminPaymentsDefaultOmit,
        param: 'status',
        params,
        pathname: adminPaymentsBasePath,
      }),
      valueLabel: labels.statusLabels[filters.status],
    });
  }

  return chips;
}

export function adminPaymentsClearFiltersHref() {
  return adminPaymentsBasePath;
}

export { adminPaymentsBasePath, adminPaymentsDefaultOmit };
