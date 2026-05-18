import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminRoleUsersInfiniteScroll } from '@/components/mit-sailing/admin/roles/AdminRoleUsersInfiniteScroll';
import { SubmitButton } from '@/components/ui/submit-button';
import type { Prisma } from '@/generated/prisma/client';
import {
  saveRolePermissionGrantsAction,
  updateUserRolesAction,
} from '@/libs/admin/roles/roleAdminActions';
import { requireAnyPermission } from '@/libs/auth/dal';
import type {
  PermissionDefinition,
  RolePermissionGrant,
} from '@/libs/auth/permissions';
import {
  AuthSubject,
  createAuthAbility,
  isRoleGrantablePermission,
  normalizeRolePermissionGrant,
  Permission,
  PERMISSION_DEFINITIONS,
  ROLE_PERMISSION_GRANT_ROLES,
} from '@/libs/auth/permissions';
import type { Role } from '@/libs/auth/roles';
import { parseRoles, ROLE_DEFINITIONS } from '@/libs/auth/roles';
import { prisma } from '@/libs/DB';
import type messages from '@/locales/en.json';
import { getI18nPath } from '@/utils/Helpers';

type AdminRolesPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ cursor?: string; status?: string }>;
};

const ADMIN_ROLES_PATH = '/admin/roles';
const ROLE_ADMIN_USERS_PAGE_SIZE = 100;

type AdminRolesKey = keyof typeof messages.AdminRoles;
type AdminRolesTranslator = Awaited<
  ReturnType<typeof getTranslations<'AdminRoles'>>
>;
type RoleAdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
};

type RoleAdminUsersPage = {
  nextCursor: string | null;
  rows: RoleAdminUserRow[];
  totalCount: number;
};

const STATUS_MESSAGE_KEYS: Partial<Record<string, AdminRolesKey>> = {
  last_admin: 'status_last_admin',
  saved: 'status_saved',
  user_saved: 'status_user_saved',
};

export async function generateMetadata(
  props: AdminRolesPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'AdminRoles' });
  return { title: t('meta_title') };
}

function roleLabel(role: Role, t: AdminRolesTranslator): string {
  const definition = ROLE_DEFINITIONS.find(
    (candidate) => candidate.key === role
  );
  return t((definition?.labelKey ?? 'role_user') as AdminRolesKey);
}

function permissionLabel(
  permission: Permission,
  t: AdminRolesTranslator
): string {
  const definition = PERMISSION_DEFINITIONS.find(
    (candidate) => candidate.key === permission
  );
  return t((definition?.labelKey ?? 'permission_admin_view') as AdminRolesKey);
}

function groupLabel(
  groupKey: PermissionDefinition['groupKey'],
  t: AdminRolesTranslator
): string {
  return t(groupKey as AdminRolesKey);
}

function statusMessage(status: string, t: AdminRolesTranslator): string | null {
  const key = STATUS_MESSAGE_KEYS[status];
  return key ? t(key) : null;
}

function grantInputValue(role: Role, permission: Permission): string {
  return `${role}:${permission}`;
}

function grantKey(role: Role, permission: Permission): string {
  return `${role}\u0000${permission}`;
}

function permissionGroups(): [
  PermissionDefinition['groupKey'],
  PermissionDefinition[],
][] {
  const groups = new Map<
    PermissionDefinition['groupKey'],
    PermissionDefinition[]
  >();
  const grantableDefinitions = PERMISSION_DEFINITIONS.filter((definition) =>
    isRoleGrantablePermission(definition.key)
  );
  for (const definition of grantableDefinitions) {
    const current = groups.get(definition.groupKey) ?? [];
    groups.set(definition.groupKey, [...current, definition]);
  }
  return [...groups.entries()];
}

async function listRoleAdminUsers(
  cursor?: string
): Promise<RoleAdminUsersPage> {
  if (cursor) {
    const cursorUser = await prisma.user.findUnique({
      where: { id: cursor },
      select: { id: true },
    });
    if (!cursorUser) {
      return listRoleAdminUsers();
    }
  }
  const userPageQuery = {
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ email: 'asc' }, { id: 'asc' }],
    select: {
      email: true,
      id: true,
      name: true,
      role: true,
    },
    take: ROLE_ADMIN_USERS_PAGE_SIZE + 1,
  } satisfies Prisma.UserFindManyArgs;
  const [rows, totalCount] = await Promise.all([
    prisma.user.findMany(userPageQuery),
    prisma.user.count(),
  ]);
  const hasNextPage = rows.length > ROLE_ADMIN_USERS_PAGE_SIZE;
  const pageRows = rows.slice(0, ROLE_ADMIN_USERS_PAGE_SIZE);
  return {
    nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
    rows: pageRows,
    totalCount,
  };
}

async function listRoleAdminGrants(): Promise<RolePermissionGrant[]> {
  const rows = await prisma.rolePermissionGrant.findMany({
    orderBy: [{ roleKey: 'asc' }, { permissionKey: 'asc' }],
    select: {
      permissionKey: true,
      roleKey: true,
    },
  });
  return rows.flatMap((row) => {
    const grant = normalizeRolePermissionGrant(row);
    return grant ? [grant] : [];
  });
}

export default async function AdminRolesPage(props: AdminRolesPageProps) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const session = await requireAnyPermission(
    [Permission.ROLES_ASSIGN, Permission.ROLES_MANAGE_PERMISSIONS],
    locale
  );
  const [grants, usersPage] = await Promise.all([
    listRoleAdminGrants(),
    listRoleAdminUsers(searchParams.cursor),
  ]);
  const currentUserRoles = parseRoles(session.user.role);
  const ability = createAuthAbility({
    grants,
    roles: currentUserRoles,
    userId: session.user.id,
  });
  const canAssignRoles = ability.can(
    Permission.ROLES_ASSIGN,
    AuthSubject.PERMISSION
  );
  const canManagePermissions = ability.can(
    Permission.ROLES_MANAGE_PERMISSIONS,
    AuthSubject.PERMISSION
  );
  const grantSet = new Set(
    grants.map((grant) => grantKey(grant.roleKey, grant.permissionKey))
  );
  const t = await getTranslations({ locale, namespace: 'AdminRoles' });
  const message = statusMessage(searchParams.status ?? '', t);
  const nextUsersHref = usersPage.nextCursor
    ? `${getI18nPath(ADMIN_ROLES_PATH, locale)}?cursor=${encodeURIComponent(usersPage.nextCursor)}`
    : null;

  return (
    <div className="flex w-full max-w-6xl flex-col gap-8">
      <AdminPageHeader title={t('title')} />
      {message ? (
        <p className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-mit-text">
          {message}
        </p>
      ) : null}

      <section className="flex flex-col gap-3" aria-labelledby="role-grants">
        <div>
          <h2 className="text-lg font-semibold text-mit-text" id="role-grants">
            {t('permission_matrix_title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('permission_matrix_intro')}
          </p>
        </div>
        <form action={saveRolePermissionGrantsAction.bind(null, locale)}>
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="w-full min-w-3xl border-collapse text-left text-sm">
              <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-3 py-2">{t('column_permission')}</th>
                  {ROLE_PERMISSION_GRANT_ROLES.map((role) => (
                    <th className="px-3 py-2 text-center" key={role}>
                      {roleLabel(role, t)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissionGroups().map(([group, definitions]) => (
                  <tr className="border-t border-border" key={group}>
                    <td className="px-3 py-3 align-top" colSpan={5}>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {groupLabel(group, t)}
                      </p>
                      <div className="mt-2 grid gap-2">
                        {definitions.map((definition) => (
                          <div
                            className="grid items-center gap-3 md:grid-cols-[minmax(16rem,1fr)_repeat(4,8rem)]"
                            key={definition.key}
                          >
                            <span className="font-medium text-mit-text">
                              {permissionLabel(definition.key, t)}
                            </span>
                            {ROLE_PERMISSION_GRANT_ROLES.map((role) => (
                              <label
                                className="flex justify-center"
                                key={grantKey(role, definition.key)}
                              >
                                <input
                                  className="size-4 accent-mit-red"
                                  defaultChecked={grantSet.has(
                                    grantKey(role, definition.key)
                                  )}
                                  disabled={!canManagePermissions}
                                  name="grant"
                                  type="checkbox"
                                  value={grantInputValue(role, definition.key)}
                                />
                                <span className="sr-only">
                                  {t('grant_label', {
                                    permission: permissionLabel(
                                      definition.key,
                                      t
                                    ),
                                    role: roleLabel(role, t),
                                  })}
                                </span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <SubmitButton
              disabled={!canManagePermissions}
              pendingLabel={t('saving')}
              variant="mit"
            >
              {t('save_permissions')}
            </SubmitButton>
          </div>
        </form>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="user-roles">
        <div>
          <h2 className="text-lg font-semibold text-mit-text" id="user-roles">
            {t('user_roles_title')}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t('user_roles_intro')}
          </p>
          <p
            className="js-role-admin-users-count mt-1 text-sm text-muted-foreground"
            data-template={t('user_roles_count')}
            data-total-count={usersPage.totalCount}
          >
            {t('user_roles_count', {
              count: usersPage.rows.length,
              total: usersPage.totalCount,
            })}
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-4xl border-collapse text-left text-sm">
            <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2">{t('column_user')}</th>
                {ROLE_DEFINITIONS.map((definition) => (
                  <th className="px-3 py-2 text-center" key={definition.key}>
                    {roleLabel(definition.key, t)}
                  </th>
                ))}
                <th className="px-3 py-2">{t('column_action')}</th>
              </tr>
            </thead>
            <tbody className="js-role-admin-users">
              {usersPage.rows.map((user) => {
                const userRoles = parseRoles(user.role);
                return (
                  <tr
                    className="js-role-admin-user-row border-t border-border"
                    key={user.id}
                  >
                    <td className="px-3 py-3 align-top">
                      <p className="font-medium text-mit-text">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </td>
                    <td className="px-3 py-3 align-top" colSpan={7}>
                      <form
                        action={updateUserRolesAction.bind(
                          null,
                          locale,
                          user.id
                        )}
                        className="grid items-center gap-3 md:grid-cols-[repeat(6,8rem)_auto]"
                      >
                        {ROLE_DEFINITIONS.map((definition) => (
                          <label
                            className="flex justify-center"
                            key={definition.key}
                          >
                            <input
                              className="size-4 accent-mit-red"
                              defaultChecked={userRoles.includes(
                                definition.key
                              )}
                              disabled={!canAssignRoles}
                              name="role"
                              required
                              type="radio"
                              value={definition.key}
                            />
                            <span className="sr-only">
                              {t('assign_label', {
                                role: roleLabel(definition.key, t),
                                user: user.email,
                              })}
                            </span>
                          </label>
                        ))}
                        <SubmitButton
                          disabled={!canAssignRoles}
                          pendingLabel={t('saving')}
                          size="sm"
                          variant="outline"
                        >
                          {t('save_user_roles')}
                        </SubmitButton>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <AdminRoleUsersInfiniteScroll />
        {nextUsersHref ? (
          <>
            <output
              className="js-role-admin-users-status text-sm text-muted-foreground"
              style={{ display: 'none' }}
            >
              <span
                className="infinite-scroll-request"
                style={{ display: 'none' }}
              >
                {t('loading_users')}
              </span>
              <span
                className="infinite-scroll-last"
                style={{ display: 'none' }}
              >
                {t('all_users_loaded')}
              </span>
              <span
                className="infinite-scroll-error"
                style={{ display: 'none' }}
              >
                {t('load_users_error')}
              </span>
            </output>
            <nav className="js-role-admin-users-nav text-sm">
              <a
                className="js-role-admin-users-next font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
                href={nextUsersHref}
              >
                {t('load_more_users')}
              </a>
            </nav>
          </>
        ) : null}
      </section>
    </div>
  );
}
