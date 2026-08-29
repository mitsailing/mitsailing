import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import {
  buildAdminListHref,
  buildAdminListHrefWithoutParam,
} from '@/libs/admin/buildAdminListHref';
import { ADMIN_USERS_PATH } from '@/libs/admin/users/adminUserPaths';
import type { AdminUsersListFilters } from '@/libs/admin/users/usersAdminHandlers';

const adminUsersDefaultOmit = {
  cardType: 'all',
  emailStatus: 'all',
  sailingCardStatus: 'all',
} as const;

export function adminUsersFilterParams(filters: AdminUsersListFilters) {
  return {
    cardType: filters.cardType === 'all' ? undefined : filters.cardType,
    emailStatus:
      filters.emailStatus === 'all' ? undefined : filters.emailStatus,
    q: filters.query.length > 0 ? filters.query : undefined,
    sailingCardStatus:
      filters.sailingCardStatus === 'all'
        ? undefined
        : filters.sailingCardStatus,
  };
}

export function adminUsersToolbarParams(
  filters: AdminUsersListFilters
): Record<string, string | undefined> {
  return {
    cardType: filters.cardType,
    emailStatus: filters.emailStatus,
    q: filters.query.length > 0 ? filters.query : undefined,
    sailingCardStatus: filters.sailingCardStatus,
  };
}

export function adminUsersActiveFilterCount(filters: AdminUsersListFilters) {
  let count = 0;
  if (filters.query.length > 0) {
    count += 1;
  }
  if (filters.emailStatus !== 'all') {
    count += 1;
  }
  if (filters.sailingCardStatus !== 'all') {
    count += 1;
  }
  if (filters.cardType !== 'all') {
    count += 1;
  }
  return count;
}

type AdminUsersFilterChipLabels = {
  cardTypeLabel: string;
  cardTypeNormal: string;
  cardTypeRacing: string;
  cardTypeTeamRacing: string;
  chipRemoveAria: (label: string) => string;
  emailStatusBounced: string;
  emailStatusLabel: string;
  emailStatusOk: string;
  emailStatusSuppressed: string;
  sailingCardStatusCurrent: string;
  sailingCardStatusExpired: string;
  sailingCardStatusLabel: string;
  sailingCardStatusNone: string;
  sailingCardStatusPending: string;
  searchLabel: string;
};

function adminUsersEmailStatusLabel(
  status: AdminUsersListFilters['emailStatus'],
  labels: AdminUsersFilterChipLabels
) {
  if (status === 'bounced') {
    return labels.emailStatusBounced;
  }
  if (status === 'suppressed') {
    return labels.emailStatusSuppressed;
  }
  return labels.emailStatusOk;
}

function adminUsersCardTypeLabel(
  cardType: AdminUsersListFilters['cardType'],
  labels: AdminUsersFilterChipLabels
) {
  if (cardType === 'racing') {
    return labels.cardTypeRacing;
  }
  if (cardType === 'team_racing') {
    return labels.cardTypeTeamRacing;
  }
  return labels.cardTypeNormal;
}

function adminUsersSailingCardStatusLabel(
  status: AdminUsersListFilters['sailingCardStatus'],
  labels: AdminUsersFilterChipLabels
) {
  if (status === 'current') {
    return labels.sailingCardStatusCurrent;
  }
  if (status === 'expired') {
    return labels.sailingCardStatusExpired;
  }
  if (status === 'none') {
    return labels.sailingCardStatusNone;
  }
  return labels.sailingCardStatusPending;
}

/**
 * Builds removable filter chips for the users admin directory.
 *
 * @param filters - Current list filters
 * @param labels - Localized chip labels
 * @returns Active filter chips
 */
export function adminUsersFilterChips(
  filters: AdminUsersListFilters,
  labels: AdminUsersFilterChipLabels
): AdminFilterChip[] {
  const params = adminUsersToolbarParams(filters);
  const chips: AdminFilterChip[] = [];

  if (filters.query.length > 0) {
    chips.push({
      key: 'q',
      label: labels.searchLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.searchLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersDefaultOmit,
        param: 'q',
        params,
        pathname: ADMIN_USERS_PATH,
      }),
      valueLabel: filters.query,
    });
  }
  if (filters.emailStatus !== 'all') {
    chips.push({
      key: 'emailStatus',
      label: labels.emailStatusLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.emailStatusLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersDefaultOmit,
        param: 'emailStatus',
        params,
        pathname: ADMIN_USERS_PATH,
      }),
      valueLabel: adminUsersEmailStatusLabel(filters.emailStatus, labels),
    });
  }
  if (filters.sailingCardStatus !== 'all') {
    chips.push({
      key: 'sailingCardStatus',
      label: labels.sailingCardStatusLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.sailingCardStatusLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersDefaultOmit,
        param: 'sailingCardStatus',
        params,
        pathname: ADMIN_USERS_PATH,
      }),
      valueLabel: adminUsersSailingCardStatusLabel(
        filters.sailingCardStatus,
        labels
      ),
    });
  }
  if (filters.cardType !== 'all') {
    chips.push({
      key: 'cardType',
      label: labels.cardTypeLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.cardTypeLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersDefaultOmit,
        param: 'cardType',
        params,
        pathname: ADMIN_USERS_PATH,
      }),
      valueLabel: adminUsersCardTypeLabel(filters.cardType, labels),
    });
  }

  return chips;
}

export function adminUsersClearFiltersHref() {
  return ADMIN_USERS_PATH;
}

export type AdminUsersPresetFilter = 'email_bounced' | 'pending_card';

/**
 * Builds a one-click preset filter href for common user-directory workflows.
 *
 * @param preset - Preset filter identifier
 * @returns Users list path with preset query params
 */
export function adminUsersPresetFilterHref(preset: AdminUsersPresetFilter) {
  if (preset === 'pending_card') {
    return buildAdminListHref({
      omitWhenDefault: adminUsersDefaultOmit,
      params: {},
      pathname: ADMIN_USERS_PATH,
      updates: { sailingCardStatus: 'pending' },
    });
  }

  return buildAdminListHref({
    omitWhenDefault: adminUsersDefaultOmit,
    params: {},
    pathname: ADMIN_USERS_PATH,
    updates: { emailStatus: 'bounced' },
  });
}

export { adminUsersDefaultOmit };
