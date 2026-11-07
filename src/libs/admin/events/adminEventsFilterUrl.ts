import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import { buildAdminListHrefWithoutParam } from '@/libs/admin/buildAdminListHref';
import { adminEventsIndexPath } from '@/libs/admin/events/eventAdminPaths';
import type { AdminEventCategoryOption } from '@/libs/admin/events/eventAdminQueries';
import { adminEventListScopeFromValue } from '@/libs/admin/events/eventAdminQueries';

export type AdminEventsListFilters = {
  categoryId?: string;
  query?: string;
  scope?: string;
};

const adminEventsDefaultOmit = {
  category: '',
  scope: 'my',
} as const;

export function adminEventsResolvedFilters(filters: AdminEventsListFilters) {
  return {
    categoryId: filters.categoryId ?? '',
    query: filters.query?.trim() ?? '',
    scope: adminEventListScopeFromValue(filters.scope),
  };
}

export function adminEventsToolbarParams(
  filters: AdminEventsListFilters
): Record<string, string | undefined> {
  const resolved = adminEventsResolvedFilters(filters);
  return {
    category: resolved.categoryId.length > 0 ? resolved.categoryId : undefined,
    q: resolved.query.length > 0 ? resolved.query : undefined,
    scope: resolved.scope === 'all' ? 'all' : undefined,
  };
}

export function adminEventsActiveFilterCount(filters: AdminEventsListFilters) {
  const resolved = adminEventsResolvedFilters(filters);
  let count = 0;
  if (resolved.query.length > 0) {
    count += 1;
  }
  if (resolved.scope === 'all') {
    count += 1;
  }
  if (resolved.categoryId.length > 0) {
    count += 1;
  }
  return count;
}

type AdminEventsFilterChipLabels = {
  categoryAll: string;
  categoryLabel: string;
  chipRemoveAria: (label: string) => string;
  scopeAll: string;
  scopeLabel: string;
  scopeMy: string;
  searchLabel: string;
};

function adminEventsCategoryLabel(
  categoryId: string,
  categories: AdminEventCategoryOption[]
) {
  return (
    categories.find((category) => category.id === categoryId)?.name ??
    categoryId
  );
}

/**
 * Builds removable filter chips for the admin events list.
 *
 * @param filters - Current list filters
 * @param categories - Category options for label lookup
 * @param labels - Localized chip labels
 * @returns Active filter chips
 */
export function adminEventsFilterChips(
  filters: AdminEventsListFilters,
  categories: AdminEventCategoryOption[],
  labels: AdminEventsFilterChipLabels
): AdminFilterChip[] {
  const resolved = adminEventsResolvedFilters(filters);
  const params = adminEventsToolbarParams(filters);
  const chips: AdminFilterChip[] = [];

  if (resolved.query.length > 0) {
    chips.push({
      key: 'q',
      label: labels.searchLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.searchLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminEventsDefaultOmit,
        param: 'q',
        params,
        pathname: adminEventsIndexPath(),
      }),
      valueLabel: resolved.query,
    });
  }
  if (resolved.scope === 'all') {
    chips.push({
      key: 'scope',
      label: labels.scopeLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.scopeLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminEventsDefaultOmit,
        param: 'scope',
        params,
        pathname: adminEventsIndexPath(),
      }),
      valueLabel: labels.scopeAll,
    });
  }
  if (resolved.categoryId.length > 0) {
    chips.push({
      key: 'category',
      label: labels.categoryLabel,
      removeAriaLabel: labels.chipRemoveAria(labels.categoryLabel),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminEventsDefaultOmit,
        param: 'category',
        params,
        pathname: adminEventsIndexPath(),
      }),
      valueLabel: adminEventsCategoryLabel(resolved.categoryId, categories),
    });
  }

  return chips;
}

export function adminEventsClearFiltersHref(filters: AdminEventsListFilters) {
  const resolved = adminEventsResolvedFilters(filters);
  if (resolved.scope === 'all') {
    return `${adminEventsIndexPath()}?scope=all`;
  }
  return adminEventsIndexPath();
}

export { adminEventsDefaultOmit };
