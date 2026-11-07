import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import { buildAdminListHrefWithoutParam } from '@/libs/admin/buildAdminListHref';
import type { AdminUsersMembershipPaymentStatusFilter } from '@/libs/admin/users/adminUserListMembershipPayment';
import { ADMIN_USERS_PATH } from '@/libs/admin/users/adminUserPaths';
import {
  adminUsersDefaultOmit,
  adminUsersFilterChips,
  adminUsersToolbarParams,
} from '@/libs/admin/users/adminUsersFilterUrl';
import type { AdminUsersListFilters } from '@/libs/admin/users/usersAdminHandlers';

const adminUsersOmitWhenDefault = {
  ...adminUsersDefaultOmit,
  membershipPaymentStatus: 'all',
} as const;

function adminUsersListToolbarParams(filters: AdminUsersListFilters) {
  return {
    ...adminUsersToolbarParams(filters),
    membershipPaymentStatus: filters.membershipPaymentStatus,
  };
}

function membershipPaymentStatusLabel(
  status: AdminUsersMembershipPaymentStatusFilter,
  labels: {
    checkoutStarted: string;
    paid: string;
    pastDue: string;
    unpaid: string;
  }
) {
  if (status === 'checkout_started') {
    return labels.checkoutStarted;
  }
  if (status === 'past_due') {
    return labels.pastDue;
  }
  if (status === 'paid') {
    return labels.paid;
  }
  return labels.unpaid;
}

type AdminUsersListFilterChipInput = {
  readonly filters: AdminUsersListFilters;
  readonly chipLabels: Parameters<typeof adminUsersFilterChips>[1];
  readonly membershipPaymentLabel: string;
  readonly membershipPaymentValueLabels: {
    checkoutStarted: string;
    paid: string;
    pastDue: string;
    unpaid: string;
  };
};

export function adminUsersListFilterChips(
  props: AdminUsersListFilterChipInput
): AdminFilterChip[] {
  const toolbarParams = adminUsersListToolbarParams(props.filters);
  const chips = adminUsersFilterChips(props.filters, props.chipLabels).map(
    (chip) => ({
      ...chip,
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersOmitWhenDefault,
        param: chip.key,
        params: toolbarParams,
        pathname: ADMIN_USERS_PATH,
      }),
    })
  );

  if (props.filters.membershipPaymentStatus !== 'all') {
    chips.push({
      key: 'membershipPaymentStatus',
      label: props.membershipPaymentLabel,
      removeAriaLabel: props.chipLabels.chipRemoveAria(
        props.membershipPaymentLabel
      ),
      removeHref: buildAdminListHrefWithoutParam({
        omitWhenDefault: adminUsersOmitWhenDefault,
        param: 'membershipPaymentStatus',
        params: toolbarParams,
        pathname: ADMIN_USERS_PATH,
      }),
      valueLabel: membershipPaymentStatusLabel(
        props.filters.membershipPaymentStatus,
        props.membershipPaymentValueLabels
      ),
    });
  }

  return chips;
}
