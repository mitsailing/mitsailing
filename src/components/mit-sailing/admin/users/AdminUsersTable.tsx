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

function adminUsersActionsCell(options: AdminUsersColumnOptions) {
  return ({ row }: { row: { original: CatalogRow } }) => {
    const rowId = String(row.original.id);
    const impersonation = options.userImpersonation;
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {options.canUpdate ? (
          <Link
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- edit path built from adminUsersEditPath and a row id.
            href={adminUsersEditPath(rowId)}
          >
            {options.t('action_edit')}
          </Link>
        ) : null}
        {options.canDelete ? (
          <Link
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- delete path built from admin base path and a row id.
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
  };
}

function adminUsersListNameHref(
  options: AdminUsersColumnOptions,
  row: CatalogRow
) {
  const nameRaw = row.name;
  if (
    !(
      options.canUpdate &&
      typeof nameRaw === 'string' &&
      nameRaw.trim().length > 0
    )
  ) {
    return;
  }
  return adminUsersPrimaryHref(options.adminBasePath, String(row.id));
}

function adminUsersFieldColumn(props: {
  readonly booleanPolarity?: 'goodWhenTrue';
  readonly field: string;
  readonly header: () => string;
  readonly kind: 'boolean' | 'number' | 'string';
  readonly meta?: AdminDataTableColumnMeta;
}): ColumnDef<CatalogRow> {
  return {
    accessorKey: props.field,
    cell: ({ row }) => (
      <AdminCatalogListCell
        booleanPolarity={props.booleanPolarity}
        field={props.field}
        kind={props.kind}
        row={row.original}
      />
    ),
    header: props.header,
    id: props.field,
    meta: props.meta,
  };
}

function buildAdminUsersContactColumns(
  options: AdminUsersColumnOptions
): ColumnDef<CatalogRow>[] {
  return [
    {
      accessorKey: 'name',
      cell: ({ row }) => (
        <AdminCatalogListCell
          field="name"
          kind="string"
          listNameEditHref={adminUsersListNameHref(options, row.original)}
          row={row.original}
        />
      ),
      header: () => options.t('column_name_label'),
      id: 'name',
    },
    adminUsersFieldColumn({
      field: 'email',
      header: () => options.t('column_email'),
      kind: 'string',
      meta: { mobileSummary: true },
    }),
    adminUsersFieldColumn({
      field: 'mitId',
      header: () => options.t('column_mit_id'),
      kind: 'string',
      meta: { desktopOnly: true },
    }),
    adminUsersFieldColumn({
      field: 'phone',
      header: () => options.t('column_phone'),
      kind: 'string',
      meta: { desktopOnly: true },
    }),
  ];
}

function buildAdminUsersCardColumns(
  options: AdminUsersColumnOptions
): ColumnDef<CatalogRow>[] {
  return [
    adminUsersFieldColumn({
      field: 'sailingCardNumber',
      header: () => options.t('column_sailing_card_number'),
      kind: 'number',
      meta: { desktopOnly: true },
    }),
    adminUsersFieldColumn({
      field: 'sailingCardStatus',
      header: () => options.t('column_sailing_card_status'),
      kind: 'string',
      meta: { mobileSummary: true },
    }),
    adminUsersFieldColumn({
      field: 'pendingCardType',
      header: () => options.t('column_pending_card_type'),
      kind: 'string',
      meta: { desktopOnly: true },
    }),
    adminUsersFieldColumn({
      field: 'appRole',
      header: () => options.t('column_role'),
      kind: 'string',
      meta: { desktopOnly: true },
    }),
    adminUsersFieldColumn({
      booleanPolarity: 'goodWhenTrue',
      field: 'emailVerified',
      header: () => options.t('column_email_verified'),
      kind: 'boolean',
      meta: { desktopOnly: true },
    }),
  ];
}

function buildAdminUsersColumns(
  options: AdminUsersColumnOptions
): ColumnDef<CatalogRow>[] {
  return [
    ...buildAdminUsersContactColumns(options),
    ...buildAdminUsersCardColumns(options),
    {
      cell: adminUsersActionsCell(options),
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
