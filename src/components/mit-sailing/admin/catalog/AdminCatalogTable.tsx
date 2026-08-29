'use client';

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminTableContainer } from '@/components/mit-sailing/admin/AdminDataRows';
import { AdminTableSurface } from '@/components/mit-sailing/admin/AdminTableSurface';
import { AdminCatalogListCell } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
import { ImpersonateButton } from '@/components/mit-sailing/admin/ImpersonateButton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  adminCatalogResourceDeletePath,
  adminCatalogResourceEditPath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import { reorderCatalogResourceAction } from '@/libs/admin/catalog/catalogActions';
import type {
  AdminCatalogResourceMessageKey,
  AdminListColumnDef,
  AdminUsersMessageKey,
  CatalogReorderScope,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { Link } from '@/libs/I18nNavigation';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';

type AdminTableMessageKey =
  | AdminCatalogResourceMessageKey
  | AdminUsersMessageKey;

const ADMIN_CATALOG_TABLE_PAGE_SIZE = 50;

type AdminCatalogTableProps = {
  readonly locale: string;
  readonly resourceId: string;
  readonly definition: CatalogResourceDefinition;
  readonly rows: CatalogRow[];
  /** When set (e.g. sailing classes), reorder applies only within this category scope. */
  readonly reorderScope?: CatalogReorderScope;
  /** Overrides `/admin/:resourceId` for edit/delete links (e.g. `/admin/users`). */
  readonly adminBasePath?: string;
  /** Users admin: impersonation controls (must be serializable; no server callbacks). */
  readonly userImpersonation?: {
    readonly accountRedirectHref: string;
    readonly currentUserId: string;
    readonly selfLabel: string;
  };
  /** Message bundle for column headers, mobile labels, and actions (not list cell pills). */
  readonly messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Optional client-side list filter for small admin directories such as users. */
  readonly search?: {
    readonly emptyKey: AdminTableMessageKey;
    readonly fields: readonly string[];
    readonly labelKey: AdminTableMessageKey;
    readonly placeholderKey: AdminTableMessageKey;
  };
  /** Optional empty-state message when server-side filters return no rows. */
  readonly emptyKey?: AdminTableMessageKey;
  /** Optional exact-match filters for secondary states that do not need table columns. */
  readonly filters?: readonly {
    readonly allKey: AdminTableMessageKey;
    readonly field: string;
    readonly labelKey: AdminTableMessageKey;
    readonly options: readonly {
      readonly labelKey: AdminTableMessageKey;
      readonly value: string;
    }[];
  }[];
};

function catalogEditHref(
  adminBasePath: string | undefined,
  resourceId: string,
  id: string
) {
  if (adminBasePath) {
    return `${adminBasePath}/${encodeURIComponent(id)}/edit`;
  }
  return adminCatalogResourceEditPath(resourceId, id);
}

function catalogDeleteHref(
  adminBasePath: string | undefined,
  resourceId: string,
  id: string
) {
  if (adminBasePath) {
    return `${adminBasePath}/${encodeURIComponent(id)}/delete`;
  }
  return adminCatalogResourceDeletePath(resourceId, id);
}

function catalogPrimaryHref(
  adminBasePath: string | undefined,
  resourceId: string,
  id: string
) {
  if (adminBasePath) {
    return `${adminBasePath}/${encodeURIComponent(id)}`;
  }
  return catalogEditHref(adminBasePath, resourceId, id);
}

function catalogPublicViewHref(
  definition: CatalogResourceDefinition,
  row: CatalogRow
) {
  const field = definition.publicViewHrefField;
  if (!field) {
    return null;
  }
  const raw = row[field];
  if (typeof raw !== 'string') {
    return null;
  }
  const href = safeCmsHref(raw);
  return href && isAppRelativeCmsHref(href) ? href : null;
}

function SortableRow(props: {
  id: string;
  children: React.ReactNode;
  dragLabel: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      className={cn(
        'grid grid-cols-[2.75rem_minmax(0,1fr)] border-b transition-colors hover:bg-muted/50 md:table-row',
        isDragging ? 'bg-mit-surface opacity-80' : undefined
      )}
      ref={setNodeRef}
      style={style}
    >
      <TableCell className="row-span-full flex w-12 items-start justify-center px-1.5 py-2 align-middle md:table-cell md:w-12">
        <Button
          aria-label={props.dragLabel}
          className="size-11 cursor-grab touch-none text-muted-foreground hover:text-foreground"
          size="icon"
          type="button"
          variant="ghost"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden className="size-5" />
        </Button>
      </TableCell>
      {props.children}
    </tr>
  );
}

function StaticRow(props: { children: React.ReactNode }) {
  return (
    <TableRow className="hidden border-b hover:bg-muted/50 md:table-row">
      {props.children}
    </TableRow>
  );
}

function ClientPaginationControls(props: {
  readonly currentPage: number;
  readonly nextLabel: string;
  readonly onPageChange: (page: number) => void;
  readonly previousLabel: string;
  readonly summary: string;
  readonly totalPages: number;
}) {
  return (
    <nav
      aria-label={props.summary}
      className="flex flex-col gap-3 border-t border-border pt-3 text-sm md:flex-row md:items-center md:justify-between"
    >
      <p className="m-0 text-mit-readable-ink">{props.summary}</p>
      <div className="flex items-center gap-2">
        <Button
          disabled={props.currentPage <= 1}
          onClick={() => {
            props.onPageChange(props.currentPage - 1);
          }}
          type="button"
          variant="outline"
        >
          {props.previousLabel}
        </Button>
        <Button
          disabled={props.currentPage >= props.totalPages}
          onClick={() => {
            props.onPageChange(props.currentPage + 1);
          }}
          type="button"
          variant="outline"
        >
          {props.nextLabel}
        </Button>
      </div>
    </nav>
  );
}

/**
 * Puts `field: "name"` columns first; keeps relative order within each group.
 *
 * @param cols - Definition order from the catalog resource
 * @returns Columns with every `name` field moved before other fields
 */
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

function narrowCatalogTableRows(options: {
  filterValues: Record<string, string>;
  filters: AdminCatalogTableProps['filters'];
  normalizedSearchQuery: string;
  orderedRows: CatalogRow[];
  search: AdminCatalogTableProps['search'];
}): CatalogRow[] {
  const { filters, normalizedSearchQuery, orderedRows, search } = options;
  if (!search && !filters) {
    return orderedRows;
  }
  return orderedRows.filter((row) => {
    const matchesSearch =
      !search ||
      !normalizedSearchQuery ||
      search.fields.some((field) =>
        String(row[field] ?? '')
          .toLowerCase()
          .includes(normalizedSearchQuery)
      );
    const matchesFilters =
      !filters ||
      filters.every((filter) => {
        const selected = options.filterValues[filter.field] ?? '';
        return selected.length === 0 || String(row[filter.field]) === selected;
      });
    return matchesSearch && matchesFilters;
  });
}

function buildCatalogTablePagination(options: {
  canDragReorder: boolean;
  currentPage: number;
  visibleRows: CatalogRow[];
}) {
  const clientPaginationEnabled =
    !options.canDragReorder &&
    options.visibleRows.length > ADMIN_CATALOG_TABLE_PAGE_SIZE;
  const totalPages = Math.max(
    1,
    Math.ceil(options.visibleRows.length / ADMIN_CATALOG_TABLE_PAGE_SIZE)
  );
  const safeCurrentPage = Math.min(
    Math.max(options.currentPage, 1),
    totalPages
  );
  const pageStartIndex = clientPaginationEnabled
    ? (safeCurrentPage - 1) * ADMIN_CATALOG_TABLE_PAGE_SIZE
    : 0;
  const rowsForRender = clientPaginationEnabled
    ? options.visibleRows.slice(
        pageStartIndex,
        pageStartIndex + ADMIN_CATALOG_TABLE_PAGE_SIZE
      )
    : options.visibleRows;
  const pageStart = options.visibleRows.length === 0 ? 0 : pageStartIndex + 1;
  const pageEnd = clientPaginationEnabled
    ? Math.min(
        options.visibleRows.length,
        pageStartIndex + ADMIN_CATALOG_TABLE_PAGE_SIZE
      )
    : options.visibleRows.length;
  return {
    clientPaginationEnabled,
    pageEnd,
    pageStart,
    rowsForRender,
    safeCurrentPage,
    totalPages,
  };
}

function AdminCatalogTableMobileRow(props: {
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly deleteHref: (id: string) => string;
  readonly displayColumns: AdminListColumnDef[];
  readonly editHref: (id: string) => string;
  readonly primaryHref: (id: string) => string;
  readonly row: CatalogRow;
  readonly t: (key: AdminTableMessageKey) => string;
  readonly userImpersonation: AdminCatalogTableProps['userImpersonation'];
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

function AdminCatalogTableRowCells(props: {
  readonly canDelete: boolean;
  readonly canUpdate: boolean;
  readonly displayColumns: AdminListColumnDef[];
  readonly deleteHref: (id: string) => string;
  readonly editHref: (id: string) => string;
  readonly primaryHref: (id: string) => string;
  readonly publicViewHref: (row: CatalogRow) => string | null;
  readonly row: CatalogRow;
  readonly t: (key: AdminTableMessageKey) => string;
  readonly userImpersonation: AdminCatalogTableProps['userImpersonation'];
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

function catalogTableMessage(options: {
  readonly key: AdminTableMessageKey;
  readonly messageNamespace: AdminCatalogTableProps['messageNamespace'];
  readonly tCatalog: ReturnType<typeof useTranslations<'AdminCatalogResource'>>;
  readonly tUsers: ReturnType<typeof useTranslations<'AdminUsers'>>;
}) {
  if (options.messageNamespace === 'AdminUsers') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- messageNamespace picks users keys
    return options.tUsers(options.key as AdminUsersMessageKey);
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- default catalog keys
  return options.tCatalog(options.key as AdminCatalogResourceMessageKey);
}

/**
 * Catalog index table with optional drag-and-drop reordering (auto-save).
 *
 * @param props - Locale, resource id, column definitions, rows
 * @returns Table markup
 */
export function AdminCatalogTable(props: AdminCatalogTableProps) {
  const tCatalog = useTranslations('AdminCatalogResource');
  const tUsers = useTranslations('AdminUsers');
  const router = useRouter();
  const canReorder = props.definition.capabilities.reorder;
  const t = (key: AdminTableMessageKey) =>
    catalogTableMessage({
      key,
      messageNamespace: props.messageNamespace,
      tCatalog,
      tUsers,
    });
  const editHref = (id: string) =>
    catalogEditHref(props.adminBasePath, props.resourceId, id);
  const deleteHref = (id: string) =>
    catalogDeleteHref(props.adminBasePath, props.resourceId, id);
  const publicViewHref = (row: CatalogRow) =>
    catalogPublicViewHref(props.definition, row);
  const primaryHref = (id: string) =>
    catalogPrimaryHref(props.adminBasePath, props.resourceId, id);

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    props.rows.map((r) => String(r.id))
  );
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setOrderedIds(props.rows.map((r) => String(r.id)));
    setCurrentPage(1);
  }, [props.rows]);

  const rowById = new Map(props.rows.map((r) => [String(r.id), r] as const));

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function persistOrder(nextIds: readonly string[]) {
    setReorderError(null);
    const result = await reorderCatalogResourceAction(
      props.locale,
      props.resourceId,
      nextIds,
      props.reorderScope
    );
    if (!result.ok) {
      setReorderError(t('reorder_error'));
      return;
    }
    router.refresh();
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = orderedIds.indexOf(String(active.id));
    const newIndex = orderedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const next = arrayMove(orderedIds, oldIndex, newIndex);
    setOrderedIds(next);
    await persistOrder(next);
  }

  const orderedRows = orderedIds
    .map((id) => rowById.get(id))
    .filter((r): r is CatalogRow => r !== undefined);

  const displayColumns = listColumnsWithNameFirst(props.definition.listColumns);
  const canUpdate = props.definition.capabilities.update;
  const canDelete = props.definition.capabilities.delete;
  const { filters, search } = props;
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const hasActiveListNarrowing =
    normalizedSearchQuery.length > 0 ||
    Object.values(filterValues).some((value) => value.length > 0);
  const canDragReorder = canReorder && !hasActiveListNarrowing;
  const visibleRows = narrowCatalogTableRows({
    filterValues,
    filters,
    normalizedSearchQuery,
    orderedRows,
    search,
  });
  const {
    clientPaginationEnabled,
    pageEnd,
    pageStart,
    rowsForRender,
    safeCurrentPage,
    totalPages,
  } = buildCatalogTablePagination({
    canDragReorder,
    currentPage,
    visibleRows,
  });
  const paginationSummary =
    props.messageNamespace === 'AdminUsers'
      ? tUsers('pagination_summary', {
          end: pageEnd,
          start: pageStart,
          total: visibleRows.length,
        })
      : tCatalog('pagination_summary', {
          end: pageEnd,
          start: pageStart,
          total: visibleRows.length,
        });
  const emptyMessageKey = props.search?.emptyKey ?? props.emptyKey;
  const emptyRow = emptyMessageKey ? (
    <TableRow>
      <TableCell
        className="px-3 py-4 text-sm text-muted-foreground"
        colSpan={displayColumns.length + (canDragReorder ? 2 : 1)}
      >
        {t(emptyMessageKey)}
      </TableCell>
    </TableRow>
  ) : null;

  function renderCells(row: CatalogRow) {
    return (
      <AdminCatalogTableRowCells
        canDelete={canDelete}
        canUpdate={canUpdate}
        deleteHref={deleteHref}
        displayColumns={displayColumns}
        editHref={editHref}
        primaryHref={primaryHref}
        publicViewHref={publicViewHref}
        row={row}
        t={t}
        userImpersonation={props.userImpersonation}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {props.search || props.filters ? (
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          {props.search ? (
            <div className="w-full md:max-w-sm">
              <Label htmlFor={`${props.resourceId}-admin-search`}>
                {t(props.search.labelKey)}
              </Label>
              <Input
                className="mt-2"
                id={`${props.resourceId}-admin-search`}
                onChange={(event) => {
                  setSearchQuery(event.currentTarget.value);
                  setCurrentPage(1);
                }}
                placeholder={t(props.search.placeholderKey)}
                type="search"
                value={searchQuery}
              />
            </div>
          ) : null}
          {props.filters?.map((filter) => (
            <div className="w-full md:max-w-56" key={filter.field}>
              <Label htmlFor={`${props.resourceId}-${filter.field}-filter`}>
                {t(filter.labelKey)}
              </Label>
              <select
                className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs transition-colors outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                id={`${props.resourceId}-${filter.field}-filter`}
                onChange={(event) => {
                  const selectedValue = event.currentTarget.value;
                  setFilterValues((current) => ({
                    ...current,
                    [filter.field]: selectedValue,
                  }));
                  setCurrentPage(1);
                }}
                value={filterValues[filter.field] ?? ''}
              >
                <option value="">{t(filter.allKey)}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      ) : null}

      {reorderError ? (
        <p className="text-sm text-destructive" role="alert">
          {reorderError}
        </p>
      ) : null}

      {canDragReorder ? (
        <AdminTableSurface
          footer={
            clientPaginationEnabled ? (
              <ClientPaginationControls
                currentPage={safeCurrentPage}
                nextLabel={t('pagination_next')}
                onPageChange={setCurrentPage}
                previousLabel={t('pagination_previous')}
                summary={paginationSummary}
                totalPages={totalPages}
              />
            ) : undefined
          }
        >
          <DndContext
            collisionDetection={closestCenter}
            onDragEnd={(event) => {
              // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the reorder promise.
              void handleDragEnd(event);
            }}
            sensors={sensors}
          >
            <AdminTableContainer className="border-0">
              <Table className="text-left md:min-w-[720px]">
                <TableHeader className="hidden md:table-header-group">
                  <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                    <TableHead
                      aria-label={t('drag_handle_aria')}
                      className="w-10 px-2 py-2"
                    />
                    {displayColumns.map((col) => (
                      <TableHead
                        key={col.field}
                        className="px-3 py-2 font-medium"
                      >
                        {t(col.headerKey)}
                      </TableHead>
                    ))}
                    <TableHead className="px-3 py-2 font-medium">
                      {t('column_actions')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <SortableContext
                  items={orderedIds}
                  strategy={verticalListSortingStrategy}
                >
                  <TableBody>
                    {rowsForRender.length === 0
                      ? emptyRow
                      : rowsForRender.map((row) => (
                          <SortableRow
                            dragLabel={t('drag_handle_aria')}
                            id={String(row.id)}
                            key={String(row.id)}
                          >
                            {renderCells(row)}
                          </SortableRow>
                        ))}
                  </TableBody>
                </SortableContext>
              </Table>
            </AdminTableContainer>
          </DndContext>
        </AdminTableSurface>
      ) : (
        <AdminTableSurface
          footer={
            clientPaginationEnabled ? (
              <ClientPaginationControls
                currentPage={safeCurrentPage}
                nextLabel={t('pagination_next')}
                onPageChange={setCurrentPage}
                previousLabel={t('pagination_previous')}
                summary={paginationSummary}
                totalPages={totalPages}
              />
            ) : undefined
          }
        >
          <AdminTableContainer className="border-0">
            <Table className="text-left md:min-w-[720px]">
              <TableHeader className="hidden md:table-header-group">
                <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                  {displayColumns.map((col) => (
                    <TableHead
                      key={col.field}
                      className="px-3 py-2 font-medium"
                    >
                      {t(col.headerKey)}
                    </TableHead>
                  ))}
                  <TableHead className="px-3 py-2 font-medium">
                    {t('column_actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rowsForRender.length === 0
                  ? emptyRow
                  : rowsForRender.flatMap((row) => [
                      <AdminCatalogTableMobileRow
                        canDelete={canDelete}
                        canUpdate={canUpdate}
                        deleteHref={deleteHref}
                        displayColumns={displayColumns}
                        editHref={editHref}
                        key={`${String(row.id)}-mobile`}
                        primaryHref={primaryHref}
                        row={row}
                        t={t}
                        userImpersonation={props.userImpersonation}
                      />,
                      <StaticRow key={String(row.id)}>
                        {renderCells(row)}
                      </StaticRow>,
                    ])}
              </TableBody>
            </Table>
          </AdminTableContainer>
        </AdminTableSurface>
      )}
    </div>
  );
}
