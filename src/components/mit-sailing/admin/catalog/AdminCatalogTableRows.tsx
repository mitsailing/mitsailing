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

function AdminCatalogRowActionLinks(props: {
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly deleteHref: CatalogRecordHrefFn;
  readonly editHref: CatalogRecordHrefFn;
  readonly rowId: string;
  readonly t: CatalogTranslatorFn;
  readonly userImpersonation: AdminCatalogTableUserImpersonation | undefined;
  readonly viewHref?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {props.viewHref ? (
        <Link
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          href={props.viewHref}
        >
          {props.t('action_view_page')}
        </Link>
      ) : null}
      {props.canUpdate ? (
        <Link
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          href={props.editHref(props.rowId)}
        >
          {props.t('action_edit')}
        </Link>
      ) : null}
      {props.canDelete ? (
        <Link
          className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
          href={props.deleteHref(props.rowId)}
        >
          {props.t('action_delete')}
        </Link>
      ) : null}
      {props.userImpersonation?.currentUserId === props.rowId ? (
        <span className="text-xs text-mit-text">
          {props.userImpersonation.selfLabel}
        </span>
      ) : null}
      {props.userImpersonation &&
      props.rowId !== props.userImpersonation.currentUserId ? (
        <ImpersonateButton
          redirectHref={props.userImpersonation.accountRedirectHref}
          userId={props.rowId}
        />
      ) : null}
    </div>
  );
}

function AdminCatalogMobileRowContent(props: {
  readonly displayColumns: AdminListColumnDef[];
  readonly canUpdate: boolean;
  readonly primaryHref: CatalogRecordHrefFn;
  readonly row: CatalogRow;
}) {
  const ordered = listColumnsWithNameFirst(props.displayColumns);
  const primaryColumn =
    ordered.find((col) => col.field === 'name') ?? ordered[0];
  if (!primaryColumn) {
    return null;
  }
  const summaryColumns = ordered
    .filter((col) => col.field !== primaryColumn.field)
    .slice(0, 2);
  const nameRaw = props.row.name;
  const listNameEditHref =
    primaryColumn.field === 'name' &&
    props.canUpdate &&
    typeof nameRaw === 'string' &&
    nameRaw.trim().length > 0
      ? props.primaryHref(String(props.row.id))
      : undefined;
  return (
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
  );
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
  const content = AdminCatalogMobileRowContent({
    canUpdate: props.canUpdate,
    displayColumns: props.displayColumns,
    primaryHref: props.primaryHref,
    row: props.row,
  });
  if (!content) {
    return null;
  }
  return (
    <TableRow className="border-b hover:bg-muted/50 md:hidden">
      {content}
      <TableCell className="px-3 py-2 align-top">
        <AdminCatalogRowActionLinks
          canDelete={props.canDelete}
          canUpdate={props.canUpdate}
          deleteHref={props.deleteHref}
          editHref={props.editHref}
          rowId={String(props.row.id)}
          t={props.t}
          userImpersonation={props.userImpersonation}
        />
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
  const rowId = String(props.row.id);
  const cols = props.displayColumns.map((col) => {
    const nameRaw = props.row.name;
    const listNameEditHref =
      col.field === 'name' &&
      props.canUpdate &&
      typeof nameRaw === 'string' &&
      nameRaw.trim().length > 0
        ? props.primaryHref(rowId)
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
  return (
    <>
      {cols}
      <TableCell className="hidden min-w-0 px-3 py-2 text-sm leading-5 md:table-cell">
        <AdminCatalogRowActionLinks
          canDelete={props.canDelete}
          canUpdate={props.canUpdate}
          deleteHref={props.deleteHref}
          editHref={props.editHref}
          rowId={rowId}
          t={props.t}
          userImpersonation={props.userImpersonation}
          viewHref={props.publicViewHref(props.row)}
        />
      </TableCell>
    </>
  );
}
