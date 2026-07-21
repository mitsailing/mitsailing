import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminActiveFilterChips } from '@/components/mit-sailing/admin/AdminActiveFilterChips';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  AdminPagination,
  adminPaginationPage,
} from '@/components/mit-sailing/admin/AdminPagination';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminTableSurface } from '@/components/mit-sailing/admin/AdminTableSurface';
import { AdminUrlFilterToolbar } from '@/components/mit-sailing/admin/AdminUrlFilterToolbar';
import { AdminUsersTable } from '@/components/mit-sailing/admin/users/AdminUsersTable';
import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import { buildAdminListHrefWithoutParam } from '@/libs/admin/buildAdminListHref';
import type {
  AdminUsersCardTypeFilter,
  AdminUsersMembershipPaymentStatusFilter,
} from '@/libs/admin/users/adminUserListMembershipPayment';
import {
  ADMIN_USERS_PATH,
  adminUsersNewPath,
} from '@/libs/admin/users/adminUserPaths';
import {
  adminUsersActiveFilterCount,
  adminUsersClearFiltersHref,
  adminUsersDefaultOmit,
  adminUsersFilterChips,
  adminUsersFilterParams,
  adminUsersPresetFilterHref,
  adminUsersToolbarParams,
} from '@/libs/admin/users/adminUsersFilterUrl';
import {
  ADMIN_USERS_PAGE_SIZE,
  listAdminUsersPage,
} from '@/libs/admin/users/usersAdminHandlers';
import type {
  AdminUsersEmailStatusFilter,
  AdminUsersListFilters,
  AdminUsersListPage,
  AdminUsersSailingCardStatusFilter,
} from '@/libs/admin/users/usersAdminHandlers';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { appRoleFromSessionUser, requirePermission } from '@/libs/auth/dal';
import { Link } from '@/libs/I18nNavigation';
import { getI18nPath } from '@/utils/Helpers';

type AdminUsersIndexPageProps = {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{
    cardType?: string | string[];
    emailStatus?: string | string[];
    membershipPaymentStatus?: string | string[];
    page?: string | string[];
    q?: string | string[];
    sailingCardStatus?: string | string[];
  }>;
};

const adminUsersOmitWhenDefault = {
  ...adminUsersDefaultOmit,
  membershipPaymentStatus: 'all',
} as const;

function searchParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0)?.trim() ?? '';
  }
  return value?.trim() ?? '';
}

function adminUsersEmailStatusFilter(
  value: string | string[] | undefined
): AdminUsersEmailStatusFilter {
  const selected = searchParamString(value);
  return selected === 'bounced' ||
    selected === 'ok' ||
    selected === 'suppressed'
    ? selected
    : 'all';
}

function adminUsersCardTypeFilter(
  value: string | string[] | undefined
): AdminUsersCardTypeFilter {
  const selected = searchParamString(value);
  return selected === 'normal' ||
    selected === 'racing' ||
    selected === 'team_racing'
    ? selected
    : 'all';
}

function adminUsersMembershipPaymentStatusFilter(
  value: string | string[] | undefined
): AdminUsersMembershipPaymentStatusFilter {
  const selected = searchParamString(value);
  return selected === 'unpaid' ||
    selected === 'checkout_started' ||
    selected === 'past_due' ||
    selected === 'paid'
    ? selected
    : 'all';
}

function adminUsersSailingCardStatusFilter(
  value: string | string[] | undefined
): AdminUsersSailingCardStatusFilter {
  const selected = searchParamString(value);
  return selected === 'current' ||
    selected === 'expired' ||
    selected === 'none' ||
    selected === 'pending'
    ? selected
    : 'all';
}

function adminUsersPaginationSummary(props: {
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

function adminUsersListToolbarParams(filters: AdminUsersListFilters) {
  return {
    ...adminUsersToolbarParams(filters),
    membershipPaymentStatus: filters.membershipPaymentStatus,
  };
}

function adminUsersListFilterParams(filters: AdminUsersListFilters) {
  return {
    ...adminUsersFilterParams(filters),
    membershipPaymentStatus:
      filters.membershipPaymentStatus === 'all'
        ? undefined
        : filters.membershipPaymentStatus,
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

function adminUsersListFilterChips(props: {
  readonly filters: AdminUsersListFilters;
  readonly chipLabels: Parameters<typeof adminUsersFilterChips>[1];
  readonly membershipPaymentLabel: string;
  readonly membershipPaymentValueLabels: {
    checkoutStarted: string;
    paid: string;
    pastDue: string;
    unpaid: string;
  };
  readonly chipRemoveAria: (label: string) => string;
}): AdminFilterChip[] {
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
      removeAriaLabel: props.chipRemoveAria(props.membershipPaymentLabel),
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

export async function generateMetadata(
  props: AdminUsersIndexPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users') };
}

/**
 * `GET /admin/users` — user directory with impersonation and scaffold actions.
 *
 * @param props - App Router page props
 * @returns Users table
 */
export default async function AdminUsersIndexPage(
  props: AdminUsersIndexPageProps
) {
  const { locale } = await props.params;
  const searchParams = (await props.searchParams) ?? {};
  setRequestLocale(locale);

  const session = await requirePermission(Permission.USERS_VIEW, locale);
  const currentUserId = session.user.id;
  const currentUserRole = appRoleFromSessionUser(session.user);
  const currentUserPermissions = getAppRolePermissions(currentUserRole);
  const canEditUsers = hasPermission(
    currentUserPermissions,
    Permission.USERS_EDIT
  );
  const canDeleteUsers = hasPermission(
    currentUserPermissions,
    Permission.USERS_DELETE
  );
  const accountHref = getI18nPath('/', locale);

  const filters = {
    cardType: adminUsersCardTypeFilter(searchParams.cardType),
    emailStatus: adminUsersEmailStatusFilter(searchParams.emailStatus),
    membershipPaymentStatus: adminUsersMembershipPaymentStatusFilter(
      searchParams.membershipPaymentStatus
    ),
    query: searchParamString(searchParams.q),
    sailingCardStatus: adminUsersSailingCardStatusFilter(
      searchParams.sailingCardStatus
    ),
  } satisfies AdminUsersListFilters;
  const usersPage: AdminUsersListPage = await listAdminUsersPage({
    filters,
    page: adminPaginationPage(searchParamString(searchParams.page)),
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
  const paginationRange = adminUsersPaginationSummary({
    page: usersPage.page,
    pageSize: usersPage.pageSize,
    total: usersPage.total,
  });
  const hasActiveFilters =
    adminUsersActiveFilterCount(filters) > 0 ||
    filters.membershipPaymentStatus !== 'all';
  const tr = await getTranslations({ locale, namespace: 'AdminUsers' });
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const ta = await getTranslations({ locale, namespace: 'AdminPage' });
  const chipLabels = {
    cardTypeLabel: tr('filter_card_type_label'),
    cardTypeNormal: tr('list_card_type_normal'),
    cardTypeRacing: tr('list_card_type_racing'),
    cardTypeTeamRacing: tr('list_card_type_team_racing'),
    chipRemoveAria: (label: string) => tr('filter_chip_remove_aria', { label }),
    emailStatusBounced: tr('email_status_bounced'),
    emailStatusLabel: tr('filter_email_status_label'),
    emailStatusOk: tr('email_status_ok'),
    emailStatusSuppressed: tr('email_status_suppressed'),
    sailingCardStatusCurrent: tr('filter_sailing_card_status_current'),
    sailingCardStatusExpired: tr('filter_sailing_card_status_expired'),
    sailingCardStatusLabel: tr('filter_sailing_card_status_label'),
    sailingCardStatusNone: tr('filter_sailing_card_status_none'),
    sailingCardStatusPending: tr('filter_sailing_card_status_pending'),
    searchLabel: tr('filter_search_label'),
  };
  const filterChips = adminUsersListFilterChips({
    chipLabels,
    chipRemoveAria: chipLabels.chipRemoveAria,
    filters,
    membershipPaymentLabel: tr('filter_membership_payment_status_label'),
    membershipPaymentValueLabels: {
      checkoutStarted: tr('list_membership_payment_checkout_started'),
      paid: tr('list_membership_payment_paid'),
      pastDue: tr('list_membership_payment_past_due'),
      unpaid: tr('list_membership_payment_unpaid'),
    },
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <AdminPageHeader
        actions={
          canEditUsers ? (
            <AdminPrimaryActionLink href={adminUsersNewPath()}>
              {tr('action_create')}
            </AdminPrimaryActionLink>
          ) : undefined
        }
        title={t('title_admin_users')}
      />
      <AdminUrlFilterToolbar
        basePath={ADMIN_USERS_PATH}
        omitWhenDefault={adminUsersOmitWhenDefault}
        params={adminUsersListToolbarParams(filters)}
        search={{
          label: tr('filter_search_label'),
          param: 'q',
          placeholder: tr('filter_search_placeholder'),
          value: filters.query,
        }}
        selects={[
          {
            defaultValue: 'all',
            label: tr('filter_email_status_label'),
            options: [
              { label: tr('filter_email_status_all'), value: 'all' },
              { label: tr('email_status_ok'), value: 'ok' },
              { label: tr('email_status_bounced'), value: 'bounced' },
              { label: tr('email_status_suppressed'), value: 'suppressed' },
            ],
            param: 'emailStatus',
            value: filters.emailStatus,
          },
          {
            defaultValue: 'all',
            label: tr('filter_sailing_card_status_label'),
            options: [
              { label: tr('filter_sailing_card_status_all'), value: 'all' },
              {
                label: tr('filter_sailing_card_status_pending'),
                value: 'pending',
              },
              {
                label: tr('filter_sailing_card_status_current'),
                value: 'current',
              },
              {
                label: tr('filter_sailing_card_status_expired'),
                value: 'expired',
              },
              { label: tr('filter_sailing_card_status_none'), value: 'none' },
            ],
            param: 'sailingCardStatus',
            value: filters.sailingCardStatus,
          },
          {
            defaultValue: 'all',
            label: tr('filter_card_type_label'),
            options: [
              { label: tr('filter_card_type_all'), value: 'all' },
              { label: tr('list_card_type_normal'), value: 'normal' },
              { label: tr('list_card_type_racing'), value: 'racing' },
              { label: tr('list_card_type_team_racing'), value: 'team_racing' },
            ],
            param: 'cardType',
            value: filters.cardType,
          },
          {
            defaultValue: 'all',
            label: tr('filter_membership_payment_status_label'),
            options: [
              {
                label: tr('filter_membership_payment_status_all'),
                value: 'all',
              },
              {
                label: tr('list_membership_payment_unpaid'),
                value: 'unpaid',
              },
              {
                label: tr('list_membership_payment_checkout_started'),
                value: 'checkout_started',
              },
              {
                label: tr('list_membership_payment_past_due'),
                value: 'past_due',
              },
              {
                label: tr('list_membership_payment_paid'),
                value: 'paid',
              },
            ],
            param: 'membershipPaymentStatus',
            value: filters.membershipPaymentStatus,
          },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        <Link
          className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
          href={adminUsersPresetFilterHref('pending_card')}
        >
          {tr('filter_preset_pending_card')}
        </Link>
        <Link
          className="rounded-full border border-border bg-background px-3 py-1 text-sm font-medium text-foreground hover:bg-muted"
          href={adminUsersPresetFilterHref('email_bounced')}
        >
          {tr('filter_preset_email_bounced')}
        </Link>
      </div>
      <AdminActiveFilterChips
        chips={filterChips}
        clearHref={hasActiveFilters ? adminUsersClearFiltersHref() : undefined}
        clearLabel={hasActiveFilters ? tr('filter_clear') : undefined}
      />

      <AdminTableSurface
        footer={
          <AdminPagination
            basePath={ADMIN_USERS_PATH}
            labels={{
              next: tr('pagination_next'),
              previous: tr('pagination_previous'),
              summary: tr('pagination_summary', {
                end: paginationRange.end,
                start: paginationRange.start,
                total: usersPage.total,
              }),
            }}
            page={usersPage.page}
            pageSize={usersPage.pageSize}
            params={adminUsersListFilterParams(filters)}
            total={usersPage.total}
          />
        }
      >
        <AdminUsersTable
          adminBasePath={ADMIN_USERS_PATH}
          canDelete={canDeleteUsers}
          canUpdate={canEditUsers}
          emptyMessage={
            hasActiveFilters ? tr('filter_empty') : tr('empty_directory')
          }
          rows={usersPage.rows}
          userImpersonation={
            canEditUsers
              ? {
                  accountRedirectHref: accountHref,
                  currentUserId,
                  selfLabel: ta('you'),
                }
              : undefined
          }
        />
      </AdminTableSurface>
    </div>
  );
}
