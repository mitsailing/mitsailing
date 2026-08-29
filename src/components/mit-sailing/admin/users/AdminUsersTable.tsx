'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { useTranslations } from 'next-intl';
import { AdminDataTable } from '@/components/mit-sailing/admin/AdminDataTable';
import type { AdminDataTableColumnMeta } from '@/components/mit-sailing/admin/AdminDataTable';
import { AdminCatalogListCell } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import { ImpersonateButton } from '@/components/mit-sailing/admin/ImpersonateButton';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { adminUsersEditPath } from '@/libs/admin/users/adminUserPaths';
import { Link } from '@/libs/I18nNavigation';

type AdminUsersTableProps = {
  readonly adminBasePath: string;
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly emptyMessage?: string;
  readonly rows: CatalogRow[];
  readonly userImpersonation?: {
    readonly accountRedirectHref: string;
    readonly currentUserId: string;
    readonly selfLabel: string;
  };
};

type AdminUsersColumnOptions = {
  readonly adminBasePath: string;
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly t: ReturnType<typeof useTranslations<'AdminUsers'>>;
  readonly userImpersonation: AdminUsersTableProps['userImpersonation'];
};

function adminUsersPrimaryHref(adminBasePath: string, id: string) {
  return `${adminBasePath}/${encodeURIComponent(id)}`;
}

function adminUsersDeleteHref(adminBasePath: string, id: string) {
  return `${adminBasePath}/${encodeURIComponent(id)}/delete`;
}

function buildAdminUsersColumns(
  options: AdminUsersColumnOptions
): ColumnDef<CatalogRow>[] {
  return [
    {
      accessorKey: 'name',
      cell: ({ row }) => {
        const nameRaw = row.original.name;
        const listNameEditHref =
          options.canUpdate &&
          typeof nameRaw === 'string' &&
          nameRaw.trim().length > 0
            ? adminUsersPrimaryHref(
                options.adminBasePath,
                String(row.original.id)
              )
            : undefined;
        return (
          <AdminCatalogListCell
            field="name"
            kind="string"
            listNameEditHref={listNameEditHref}
            row={row.original}
          />
        );
      },
      header: () => options.t('column_name_label'),
      id: 'name',
    },
    {
      accessorKey: 'email',
      cell: ({ row }) => (
        <AdminCatalogListCell field="email" kind="string" row={row.original} />
      ),
      header: () => options.t('column_email'),
      id: 'email',
      meta: { mobileSummary: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'mitId',
      cell: ({ row }) => (
        <AdminCatalogListCell field="mitId" kind="string" row={row.original} />
      ),
      header: () => options.t('column_mit_id'),
      id: 'mitId',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'phone',
      cell: ({ row }) => (
        <AdminCatalogListCell field="phone" kind="string" row={row.original} />
      ),
      header: () => options.t('column_phone'),
      id: 'phone',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'sailingCardNumber',
      cell: ({ row }) => (
        <AdminCatalogListCell
          field="sailingCardNumber"
          kind="number"
          row={row.original}
        />
      ),
      header: () => options.t('column_sailing_card_number'),
      id: 'sailingCardNumber',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'sailingCardStatus',
      cell: ({ row }) => (
        <AdminCatalogListCell
          field="sailingCardStatus"
          kind="string"
          row={row.original}
        />
      ),
      header: () => options.t('column_sailing_card_status'),
      id: 'sailingCardStatus',
      meta: { mobileSummary: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'pendingCardType',
      cell: ({ row }) => (
        <AdminCatalogListCell
          field="pendingCardType"
          kind="string"
          row={row.original}
        />
      ),
      header: () => options.t('column_pending_card_type'),
      id: 'pendingCardType',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'appRole',
      cell: ({ row }) => (
        <AdminCatalogListCell
          field="appRole"
          kind="string"
          row={row.original}
        />
      ),
      header: () => options.t('column_role'),
      id: 'appRole',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'emailVerified',
      cell: ({ row }) => (
        <AdminCatalogListCell
          booleanPolarity="goodWhenTrue"
          field="emailVerified"
          kind="boolean"
          row={row.original}
        />
      ),
      header: () => options.t('column_email_verified'),
      id: 'emailVerified',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      cell: ({ row }) => {
        const rowId = String(row.original.id);
        const impersonation = options.userImpersonation;
        return (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {options.canUpdate ? (
              <Link
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                href={adminUsersEditPath(rowId)}
              >
                {options.t('action_edit')}
              </Link>
            ) : null}
            {options.canDelete ? (
              <Link
                className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
                href={adminUsersDeleteHref(options.adminBasePath, rowId)}
              >
                {options.t('action_delete')}
              </Link>
            ) : null}
            {impersonation?.currentUserId === rowId ? (
              <span className="text-xs text-mit-text">
                {impersonation.selfLabel}
              </span>
            ) : null}
            {impersonation && impersonation.currentUserId !== rowId ? (
              <ImpersonateButton
                redirectHref={impersonation.accountRedirectHref}
                userId={rowId}
              />
            ) : null}
          </div>
        );
      },
      header: () => options.t('column_actions'),
      id: 'actions',
    },
  ];
}

/**
 * Users admin directory table with compact mobile rows.
 *
 * @param props - Users list props
 * @returns Users table markup
 */
export function AdminUsersTable(props: AdminUsersTableProps) {
  const t = useTranslations('AdminUsers');
  const columns = buildAdminUsersColumns({
    adminBasePath: props.adminBasePath,
    canDelete: props.canDelete,
    canUpdate: props.canUpdate,
    t,
    userImpersonation: props.userImpersonation,
  });

  return (
    <AdminDataTable
      columns={columns}
      data={props.rows}
      emptyMessage={props.emptyMessage}
      getRowId={(row) => String(row.id)}
      mobilePrimaryColumnId="name"
    />
  );
}
