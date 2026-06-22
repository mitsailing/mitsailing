import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  AdminPagination,
  adminPaginationPage,
} from '@/components/mit-sailing/admin/AdminPagination';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import { AdminCatalogTable } from '@/components/mit-sailing/admin/catalog/AdminCatalogTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type {
  AdminUsersCardTypeFilter,
  AdminUsersMembershipPaymentStatusFilter,
} from '@/libs/admin/users/adminUserListMembershipPayment';
import {
  ADMIN_USERS_PATH,
  adminUsersNewPath,
} from '@/libs/admin/users/adminUserPaths';
import { usersAdminDefinition } from '@/libs/admin/users/userAdminDefinitions';
import {
  ADMIN_USERS_PAGE_SIZE,
  listAdminUsersPage,
} from '@/libs/admin/users/usersAdminHandlers';
import type {
  AdminUsersEmailStatusFilter,
  AdminUsersListFilters,
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

function adminUsersFilterParams(filters: AdminUsersListFilters) {
  return {
    cardType: filters.cardType === 'all' ? undefined : filters.cardType,
    emailStatus:
      filters.emailStatus === 'all' ? undefined : filters.emailStatus,
    membershipPaymentStatus:
      filters.membershipPaymentStatus === 'all'
        ? undefined
        : filters.membershipPaymentStatus,
    q: filters.query,
    sailingCardStatus:
      filters.sailingCardStatus === 'all'
        ? undefined
        : filters.sailingCardStatus,
  };
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
  const usersPage = await listAdminUsersPage({
    filters,
    page: adminPaginationPage(searchParamString(searchParams.page)),
    pageSize: ADMIN_USERS_PAGE_SIZE,
  });
  const paginationRange = adminUsersPaginationSummary(usersPage);
  const hasActiveFilters =
    filters.query.length > 0 ||
    filters.emailStatus !== 'all' ||
    filters.sailingCardStatus !== 'all' ||
    filters.cardType !== 'all' ||
    filters.membershipPaymentStatus !== 'all';
  const tr = await getTranslations({ locale, namespace: 'AdminUsers' });
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  const ta = await getTranslations({ locale, namespace: 'AdminPage' });

  return (
    <div className="flex w-full flex-col gap-6">
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
      <form
        action={ADMIN_USERS_PATH}
        className="grid gap-3 md:grid-cols-[minmax(16rem,1fr)_14rem_14rem_14rem_14rem_auto] md:items-end"
        method="get"
      >
        <div>
          <Label htmlFor="admin-users-q">{tr('filter_search_label')}</Label>
          <Input
            className="mt-2"
            defaultValue={filters.query}
            id="admin-users-q"
            name="q"
            placeholder={tr('filter_search_placeholder')}
            type="search"
          />
        </div>
        <div>
          <Label htmlFor="admin-users-email-status">
            {tr('filter_email_status_label')}
          </Label>
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            defaultValue={filters.emailStatus}
            id="admin-users-email-status"
            name="emailStatus"
          >
            <option value="all">{tr('filter_email_status_all')}</option>
            <option value="ok">{tr('email_status_ok')}</option>
            <option value="bounced">{tr('email_status_bounced')}</option>
            <option value="suppressed">{tr('email_status_suppressed')}</option>
          </select>
        </div>
        <div>
          <Label htmlFor="admin-users-card-status">
            {tr('filter_sailing_card_status_label')}
          </Label>
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            defaultValue={filters.sailingCardStatus}
            id="admin-users-card-status"
            name="sailingCardStatus"
          >
            <option value="all">{tr('filter_sailing_card_status_all')}</option>
            <option value="pending">
              {tr('filter_sailing_card_status_pending')}
            </option>
            <option value="current">
              {tr('filter_sailing_card_status_current')}
            </option>
            <option value="expired">
              {tr('filter_sailing_card_status_expired')}
            </option>
            <option value="none">
              {tr('filter_sailing_card_status_none')}
            </option>
          </select>
        </div>
        <div>
          <Label htmlFor="admin-users-card-type">
            {tr('filter_card_type_label')}
          </Label>
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            defaultValue={filters.cardType}
            id="admin-users-card-type"
            name="cardType"
          >
            <option value="all">{tr('filter_card_type_all')}</option>
            <option value="normal">{tr('list_card_type_normal')}</option>
            <option value="racing">{tr('list_card_type_racing')}</option>
            <option value="team_racing">
              {tr('list_card_type_team_racing')}
            </option>
          </select>
        </div>
        <div>
          <Label htmlFor="admin-users-membership-payment-status">
            {tr('filter_membership_payment_status_label')}
          </Label>
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            defaultValue={filters.membershipPaymentStatus}
            id="admin-users-membership-payment-status"
            name="membershipPaymentStatus"
          >
            <option value="all">
              {tr('filter_membership_payment_status_all')}
            </option>
            <option value="unpaid">
              {tr('list_membership_payment_unpaid')}
            </option>
            <option value="checkout_started">
              {tr('list_membership_payment_checkout_started')}
            </option>
            <option value="past_due">
              {tr('list_membership_payment_past_due')}
            </option>
            <option value="paid">{tr('list_membership_payment_paid')}</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit">{tr('filter_submit')}</Button>
          {hasActiveFilters ? (
            <Button asChild type="button" variant="outline">
              <Link href={ADMIN_USERS_PATH}>{tr('filter_clear')}</Link>
            </Button>
          ) : null}
        </div>
      </form>

      <AdminCatalogTable
        adminBasePath={ADMIN_USERS_PATH}
        definition={{
          ...usersAdminDefinition,
          capabilities: {
            create: canEditUsers,
            delete: canDeleteUsers,
            reorder: false,
            update: canEditUsers,
          },
        }}
        emptyKey={hasActiveFilters ? 'filter_empty' : undefined}
        locale={locale}
        messageNamespace="AdminUsers"
        resourceId={usersAdminDefinition.id}
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
        params={adminUsersFilterParams(filters)}
        total={usersPage.total}
      />
    </div>
  );
}
