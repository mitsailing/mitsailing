'use client';

import { AdminCatalogListCell } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import { ImpersonateButton } from '@/components/mit-sailing/admin/ImpersonateButton';
import { TableCell, TableRow } from '@/components/ui/table';
import type {
  AdminListColumnDef,
  AdminTableMessageKey,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { Link } from '@/libs/I18nNavigation';

export type AdminCatalogTableUserImpersonation = {
  readonly accountRedirectHref: string;
  readonly currentUserId: string;
  readonly selfLabel: string;
};

type CatalogRecordHrefFn = (...args: [string]) => string;
type CatalogTranslatorFn = (...args: [AdminTableMessageKey]) => string;
type CatalogPublicViewHrefFn = (...args: [CatalogRow]) => string | null;

function listColumnsWithNameFirst(
  cols: readonly AdminListColumnDef[]
): AdminListColumnDef[] {
  if (!cols.some((c) => c.field === 'name')) {
    return [...cols];
  }
  const nameCols = cols.filter((c) => c.field === 'name');
  const rest = cols.filter((c) => c.field !== 'name');
  return [...nameCols, ...rest];
}

export function AdminCatalogTableMobileRow(props: {
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly deleteHref: CatalogRecordHrefFn;
  readonly displayColumns: AdminListColumnDef[];
  readonly editHref: CatalogRecordHrefFn;
  readonly primaryHref: CatalogRecordHrefFn;
  readonly row: CatalogRow;
  readonly t: CatalogTranslatorFn;
  readonly userImpersonation: AdminCatalogTableUserImpersonation | undefined;
}) {
  const ordered = listColumnsWithNameFirst(props.displayColumns);
  const primaryColumn =
    ordered.find((col) => col.field === 'name') ?? ordered[0];
  const summaryColumns = ordered
    .filter((col) => col.field !== primaryColumn?.field)
    .slice(0, 2);
  if (!primaryColumn) {
    return null;
  }
  const nameRaw = props.row.name;
  const listNameEditHref =
    primaryColumn.field === 'name' &&
    props.canUpdate &&
    typeof nameRaw === 'string' &&
    nameRaw.trim().length > 0
      ? props.primaryHref(String(props.row.id))
      : undefined;

  return (
    <TableRow className="border-b hover:bg-muted/50 md:hidden">
      <TableCell className="px-3 py-2 align-top" colSpan={1}>
        <AdminCatalogListCell
          booleanPolarity={primaryColumn.booleanPolarity}
          field={primaryColumn.field}
          kind={primaryColumn.kind}
          listNameEditHref={listNameEditHref}
          row={props.row}
        />
        <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
          {summaryColumns.map((col) => (
            <div key={col.field}>
              <AdminCatalogListCell
                booleanPolarity={col.booleanPolarity}
                field={col.field}
                kind={col.kind}
                row={props.row}
              />
            </div>
          ))}
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 align-top">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {props.canUpdate ? (
            <Link
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              href={props.editHref(String(props.row.id))}
            >
              {props.t('action_edit')}
            </Link>
          ) : null}
          {props.canDelete ? (
            <Link
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
              href={props.deleteHref(String(props.row.id))}
            >
              {props.t('action_delete')}
            </Link>
          ) : null}
          {props.userImpersonation?.currentUserId === String(props.row.id) ? (
            <span className="text-xs text-mit-text">
              {props.userImpersonation.selfLabel}
            </span>
          ) : null}
          {props.userImpersonation &&
          String(props.row.id) !== props.userImpersonation.currentUserId ? (
            <ImpersonateButton
              redirectHref={props.userImpersonation.accountRedirectHref}
              userId={String(props.row.id)}
            />
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

export function AdminCatalogTableRowCells(props: {
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly displayColumns: AdminListColumnDef[];
  readonly deleteHref: CatalogRecordHrefFn;
  readonly editHref: CatalogRecordHrefFn;
  readonly primaryHref: CatalogRecordHrefFn;
  readonly publicViewHref: CatalogPublicViewHrefFn;
  readonly row: CatalogRow;
  readonly t: CatalogTranslatorFn;
  readonly userImpersonation: AdminCatalogTableUserImpersonation | undefined;
}) {
  const cols = props.displayColumns.map((col) => {
    const nameRaw = props.row.name;
    const listNameEditHref =
      col.field === 'name' &&
      props.canUpdate &&
      typeof nameRaw === 'string' &&
      nameRaw.trim().length > 0
        ? props.primaryHref(String(props.row.id))
        : undefined;
    return (
      <TableCell
        key={col.field}
        className="hidden min-w-0 px-3 py-2 text-sm leading-5 text-foreground md:table-cell"
      >
        <AdminCatalogListCell
          booleanPolarity={col.booleanPolarity}
          field={col.field}
          kind={col.kind}
          listNameEditHref={listNameEditHref}
          row={props.row}
        />
      </TableCell>
    );
  });
  const viewHref = props.publicViewHref(props.row);
  const actions = (
    <TableCell className="hidden min-w-0 px-3 py-2 text-sm leading-5 md:table-cell">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {viewHref ? (
          <Link
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            href={viewHref}
          >
            {props.t('action_view_page')}
          </Link>
        ) : null}
        {props.canUpdate ? (
          <Link
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            href={props.editHref(String(props.row.id))}
          >
            {props.t('action_edit')}
          </Link>
        ) : null}
        {props.canDelete ? (
          <Link
            className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            href={props.deleteHref(String(props.row.id))}
          >
            {props.t('action_delete')}
          </Link>
        ) : null}
        {props.userImpersonation?.currentUserId === String(props.row.id) ? (
          <span className="text-xs text-mit-text">
            {props.userImpersonation.selfLabel}
          </span>
        ) : null}
        {props.userImpersonation &&
        String(props.row.id) !== props.userImpersonation.currentUserId ? (
          <ImpersonateButton
            redirectHref={props.userImpersonation.accountRedirectHref}
            userId={String(props.row.id)}
          />
        ) : null}
      </div>
    </TableCell>
  );
  return (
    <>
      {cols}
      {actions}
    </>
  );
}
