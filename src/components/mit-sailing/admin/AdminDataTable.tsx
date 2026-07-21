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
  columns: ColumnDef<TData>[];
  data: TData[];
  emptyMessage?: string;
  getRowId: (row: TData) => string;
  mobilePrimaryColumnId?: string;
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
  actionsColumnId: string;
  primaryColumnId: string;
  row: Row<TData>;
  summaryColumnIds: readonly string[];
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
export function AdminDataTable<TData>(props: AdminDataTableProps<TData>) {
  const table = useReactTable({
    columns: props.columns,
    data: props.data,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, index) => props.getRowId(row) || String(index),
  });

  const summaryColumnIds = adminDataTableSummaryColumnIds(props.columns);
  const primaryColumnId =
    props.mobilePrimaryColumnId ??
    props.columns.find((column) => column.id === 'name')?.id ??
    props.columns[0]?.id ??
    'name';
  const { rows } = table.getRowModel();
  const hasActions = props.columns.some((column) => column.id === 'actions');

  return (
    <AdminTableContainer className="border-0">
      <Table className="text-left md:min-w-[720px]">
        <TableHeader className="hidden md:table-header-group">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow
              className="border-b bg-muted/50 hover:bg-muted/50"
              key={headerGroup.id}
            >
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as
                  | AdminDataTableColumnMeta
                  | undefined;
                if (meta?.desktopOnly && header.column.id !== 'actions') {
                  return (
                    <TableHead
                      className="hidden px-3 py-2 font-medium md:table-cell"
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
                }
                return (
                  <TableHead
                    className={cn(
                      'px-3 py-2 font-medium',
                      header.column.id === 'actions'
                        ? 'hidden md:table-cell'
                        : undefined
                    )}
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
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell
                className="px-3 py-4 text-sm text-muted-foreground"
                colSpan={props.columns.length}
              >
                {props.emptyMessage ?? ''}
              </TableCell>
            </TableRow>
          ) : (
            rows.flatMap((row) => [
              hasActions ? (
                <AdminDataTableMobileRow
                  actionsColumnId="actions"
                  key={`${row.id}-mobile`}
                  primaryColumnId={primaryColumnId}
                  row={row}
                  summaryColumnIds={summaryColumnIds}
                />
              ) : null,
              <TableRow
                className="hidden border-b hover:bg-muted/50 md:table-row"
                key={`${row.id}-desktop`}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as
                    | AdminDataTableColumnMeta
                    | undefined;
                  return (
                    <TableCell
                      className={cn(
                        'px-3 py-2',
                        meta?.desktopOnly ? 'hidden md:table-cell' : undefined,
                        cell.column.id === 'actions'
                          ? 'hidden md:table-cell'
                          : undefined
                      )}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>,
            ])
          )}
        </TableBody>
      </Table>
    </AdminTableContainer>
  );
}
