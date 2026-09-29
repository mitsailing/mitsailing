'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { ColumnDef, Row } from '@tanstack/react-table';
import { AdminTableContainer } from '@/components/mit-sailing/admin/AdminDataRows';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type AdminDataTableColumnMeta = {
  /** Included in the compact mobile summary row below the primary column. */
  mobileSummary?: boolean;
  /** Hidden below the `md` breakpoint. */
  desktopOnly?: boolean;
};

type AdminDataTableProps<TData> = {
  readonly columns: ColumnDef<TData>[];
  readonly data: TData[];
  readonly emptyMessage?: string;
  readonly getRowId: (row: TData) => string;
  readonly mobilePrimaryColumnId?: string;
};

function adminDataTableSummaryColumnIds<TData>(
  columns: ColumnDef<TData>[]
): string[] {
  return columns
    .filter((column) => {
      const meta = column.meta as AdminDataTableColumnMeta | undefined;
      return meta?.mobileSummary === true;
    })
    .map((column) => column.id ?? '')
    .filter((id) => id.length > 0);
}

function AdminDataTableMobileRow<TData>(props: {
  readonly actionsColumnId: string;
  readonly primaryColumnId: string;
  readonly row: Row<TData>;
  readonly summaryColumnIds: readonly string[];
}) {
  const cellsById = new Map(
    props.row.getVisibleCells().map((cell) => [cell.column.id, cell])
  );
  const primaryCell = cellsById.get(props.primaryColumnId);
  const actionsCell = cellsById.get(props.actionsColumnId);

  return (
    <TableRow className="border-b hover:bg-muted/50 md:hidden">
      <TableCell className="px-3 py-2 align-top" colSpan={1}>
        {primaryCell
          ? flexRender(
              primaryCell.column.columnDef.cell,
              primaryCell.getContext()
            )
          : null}
        <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
          {props.summaryColumnIds.map((columnId) => {
            const cell = cellsById.get(columnId);
            if (!cell) {
              return null;
            }
            return (
              <div key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </div>
            );
          })}
        </div>
      </TableCell>
      <TableCell className="px-3 py-2 align-top">
        {actionsCell
          ? flexRender(
              actionsCell.column.columnDef.cell,
              actionsCell.getContext()
            )
          : null}
      </TableCell>
    </TableRow>
  );
}

/**
 * TanStack-powered admin table with compact mobile rows.
 *
 * @param props - Column definitions and row data
 * @returns Responsive admin table markup
 */

function adminDataTableHeaderClassName(props: {
  readonly columnId: string;
  readonly desktopOnly: boolean | undefined;
}) {
  if (props.desktopOnly && props.columnId !== 'actions') {
    return 'hidden px-3 py-2 font-medium md:table-cell';
  }
  return cn(
    'px-3 py-2 font-medium',
    props.columnId === 'actions' ? 'hidden md:table-cell' : undefined
  );
}

function adminDataTableCellClassName(props: {
  readonly columnId: string;
  readonly desktopOnly: boolean | undefined;
}) {
  return cn(
    'px-3 py-2',
    props.desktopOnly ? 'hidden md:table-cell' : undefined,
    props.columnId === 'actions' ? 'hidden md:table-cell' : undefined
  );
}

function AdminDataTableHeaders<TData>(props: {
  readonly table: ReturnType<typeof useReactTable<TData>>;
}) {
  return (
    <TableHeader className="hidden md:table-header-group">
      {props.table.getHeaderGroups().map((headerGroup) => (
        <TableRow
          className="border-b bg-muted/50 hover:bg-muted/50"
          key={headerGroup.id}
        >
          {headerGroup.headers.map((header) => {
            const meta = header.column.columnDef.meta as
              | AdminDataTableColumnMeta
              | undefined;
            return (
              <TableHead
                className={adminDataTableHeaderClassName({
                  columnId: header.column.id,
                  desktopOnly: meta?.desktopOnly,
                })}
                key={header.id}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
              </TableHead>
            );
          })}
        </TableRow>
      ))}
    </TableHeader>
  );
}

function AdminDataTableDesktopRow<TData>(props: { readonly row: Row<TData> }) {
  return (
    <TableRow className="hidden border-b hover:bg-muted/50 md:table-row">
      {props.row.getVisibleCells().map((cell) => {
        const meta = cell.column.columnDef.meta as
          | AdminDataTableColumnMeta
          | undefined;
        return (
          <TableCell
            className={adminDataTableCellClassName({
              columnId: cell.column.id,
              desktopOnly: meta?.desktopOnly,
            })}
            key={cell.id}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function AdminDataTableRows<TData>(props: {
  readonly columnCount: number;
  readonly emptyMessage: string;
  readonly hasActions: boolean;
  readonly primaryColumnId: string;
  readonly rows: Row<TData>[];
  readonly summaryColumnIds: string[];
}) {
  if (props.rows.length === 0) {
    return (
      <TableRow>
        <TableCell
          className="px-3 py-4 text-sm text-muted-foreground"
          colSpan={props.columnCount}
        >
          {props.emptyMessage}
        </TableCell>
      </TableRow>
    );
  }

  return props.rows.flatMap((row) => [
    props.hasActions ? (
      <AdminDataTableMobileRow
        actionsColumnId="actions"
        key={`${row.id}-mobile`}
        primaryColumnId={props.primaryColumnId}
        row={row}
        summaryColumnIds={props.summaryColumnIds}
      />
    ) : null,
    <AdminDataTableDesktopRow key={`${row.id}-desktop`} row={row} />,
  ]);
}

function adminDataTablePrimaryColumnId<TData>(props: {
  readonly columns: ColumnDef<TData>[];
  readonly mobilePrimaryColumnId?: string;
}) {
  if (props.mobilePrimaryColumnId) {
    return props.mobilePrimaryColumnId;
  }
  const named = props.columns.find((column) => column.id === 'name')?.id;
  if (named) {
    return named;
  }
  return props.columns[0]?.id ?? 'name';
}

export function AdminDataTable<TData>(props: AdminDataTableProps<TData>) {
  const table = useReactTable({
    columns: props.columns,
    data: props.data,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => props.getRowId(row) || String(index),
  });
  const summaryColumnIds = adminDataTableSummaryColumnIds(props.columns);
  const primaryColumnId = adminDataTablePrimaryColumnId({
    columns: props.columns,
    mobilePrimaryColumnId: props.mobilePrimaryColumnId,
  });
  const { rows } = table.getRowModel();
  const hasActions = props.columns.some((column) => column.id === 'actions');

  return (
    <AdminTableContainer className="border-0">
      <Table className="text-left md:min-w-[720px]">
        <AdminDataTableHeaders table={table} />
        <TableBody>
          <AdminDataTableRows
            columnCount={props.columns.length}
            emptyMessage={props.emptyMessage ?? ''}
            hasActions={hasActions}
            primaryColumnId={primaryColumnId}
            rows={rows}
            summaryColumnIds={summaryColumnIds}
          />
        </TableBody>
      </Table>
    </AdminTableContainer>
  );
}
