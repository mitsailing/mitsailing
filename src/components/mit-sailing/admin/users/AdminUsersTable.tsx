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
  adminBasePath: string;
  canDelete: boolean;
  canUpdate: boolean;
  emptyMessage?: string;
  rows: CatalogRow[];
  userImpersonation?: {
    accountRedirectHref: string;
    currentUserId: string;
    selfLabel: string;
  };
};

/**
 * Users admin directory table with compact mobile rows.
 *
 * @param props - Users list props
 * @returns Users table markup
 */
export function AdminUsersTable(props: AdminUsersTableProps) {
  const t = useTranslations('AdminUsers');

  function primaryHref(id: string) {
    return `${props.adminBasePath}/${encodeURIComponent(id)}`;
  }

  function editHref(id: string) {
    return adminUsersEditPath(id);
  }

  function deleteHref(id: string) {
    return `${props.adminBasePath}/${encodeURIComponent(id)}/delete`;
  }

  const columns: ColumnDef<CatalogRow>[] = [
    {
      accessorKey: 'name',
      cell: ({ row }) => {
        const nameRaw = row.original.name;
        const listNameEditHref =
          props.canUpdate &&
          typeof nameRaw === 'string' &&
          nameRaw.trim().length > 0
            ? primaryHref(String(row.original.id))
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
      header: () => t('column_name_label'),
      id: 'name',
    },
    {
      accessorKey: 'email',
      cell: ({ row }) => (
        <AdminCatalogListCell field="email" kind="string" row={row.original} />
      ),
      header: () => t('column_email'),
      id: 'email',
      meta: { mobileSummary: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'mitId',
      cell: ({ row }) => (
        <AdminCatalogListCell field="mitId" kind="string" row={row.original} />
      ),
      header: () => t('column_mit_id'),
      id: 'mitId',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      accessorKey: 'phone',
      cell: ({ row }) => (
        <AdminCatalogListCell field="phone" kind="string" row={row.original} />
      ),
      header: () => t('column_phone'),
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
      header: () => t('column_sailing_card_number'),
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
      header: () => t('column_sailing_card_status'),
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
      header: () => t('column_pending_card_type'),
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
      header: () => t('column_role'),
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
      header: () => t('column_email_verified'),
      id: 'emailVerified',
      meta: { desktopOnly: true } satisfies AdminDataTableColumnMeta,
    },
    {
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {props.canUpdate ? (
            <Link
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              href={editHref(String(row.original.id))}
            >
              {t('action_edit')}
            </Link>
          ) : null}
          {props.canDelete ? (
            <Link
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              href={deleteHref(String(row.original.id))}
            >
              {t('action_delete')}
            </Link>
          ) : null}
          {props.userImpersonation &&
          String(row.original.id) === props.userImpersonation.currentUserId ? (
            <span className="text-xs text-mit-text">
              {props.userImpersonation.selfLabel}
            </span>
          ) : null}
          {props.userImpersonation &&
          String(row.original.id) !== props.userImpersonation.currentUserId ? (
            <ImpersonateButton
              redirectHref={props.userImpersonation.accountRedirectHref}
              userId={String(row.original.id)}
            />
          ) : null}
        </div>
      ),
      header: () => t('column_actions'),
      id: 'actions',
    },
  ];

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
