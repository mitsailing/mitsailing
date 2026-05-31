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
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AdminCatalogListCell } from '@/components/mit-sailing/admin/catalog/AdminCatalogListCell';
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
  AdminListColumnDef,
  CatalogReorderScope,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { Link } from '@/libs/I18nNavigation';
import { isAppRelativeCmsHref, safeCmsHref } from '@/libs/mit-sailing/cmsHref';

const ImpersonateButtonClient = dynamic(
  async () => {
    const mod =
      await import('@/components/mit-sailing/admin/ImpersonateButton');
    return { default: mod.ImpersonateButton };
  },
  { ssr: false }
);

type AdminCatalogTableProps = {
  locale: string;
  resourceId: string;
  definition: CatalogResourceDefinition;
  rows: CatalogRow[];
  /** When set (e.g. sailing classes), reorder applies only within this category scope. */
  reorderScope?: CatalogReorderScope;
  /** Overrides `/admin/:resourceId` for edit/delete links (e.g. `/admin/users`). */
  adminBasePath?: string;
  /** Users admin: impersonation controls (must be serializable; no server callbacks). */
  userImpersonation?: {
    accountRedirectHref: string;
    currentUserId: string;
    selfLabel: string;
  };
  /** Message bundle for column headers, mobile labels, and actions (not list cell pills). */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
  /** Optional client-side list filter for small admin directories such as users. */
  search?: {
    emptyKey: string;
    fields: readonly string[];
    labelKey: string;
    placeholderKey: string;
  };
  /** Optional exact-match filters for secondary states that do not need table columns. */
  filters?: readonly {
    allKey: string;
    field: string;
    labelKey: string;
    options: readonly {
      labelKey: string;
      value: string;
    }[];
  }[];
};

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
      <TableCell className="row-span-full flex w-11 items-start justify-center px-2 py-3 align-middle md:table-cell md:w-10">
        <Button
          aria-label={props.dragLabel}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
          size="icon-sm"
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
    <TableRow className="grid grid-cols-1 md:table-row">
      {props.children}
    </TableRow>
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

/**
 * Catalog index table with optional drag-and-drop reordering (auto-save).
 *
 * @param props - Locale, resource id, column definitions, rows
 * @returns Table markup
 */
export function AdminCatalogTable(props: AdminCatalogTableProps) {
  const tCatalog = useTranslations('AdminCatalogResource');
  const tUsers = useTranslations('AdminUsers');
  /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- next-intl returns namespace-bound translators; this table switches between the two configured namespaces. */
  const t =
    props.messageNamespace === 'AdminUsers'
      ? (tUsers as (key: string) => string)
      : (tCatalog as (key: string) => string);
  /* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
  const router = useRouter();
  const canReorder = props.definition.capabilities.reorder;

  function editHref(id: string): string {
    if (props.adminBasePath) {
      return `${props.adminBasePath}/${encodeURIComponent(id)}/edit`;
    }
    return adminCatalogResourceEditPath(props.resourceId, id);
  }

  function deleteHref(id: string): string {
    if (props.adminBasePath) {
      return `${props.adminBasePath}/${encodeURIComponent(id)}/delete`;
    }
    return adminCatalogResourceDeletePath(props.resourceId, id);
  }

  function publicViewHref(row: CatalogRow): string | null {
    const field = props.definition.publicViewHrefField;
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

  function primaryHref(id: string): string {
    if (props.adminBasePath) {
      return `${props.adminBasePath}/${encodeURIComponent(id)}`;
    }
    return editHref(id);
  }

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    props.rows.map((r) => String(r.id))
  );
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setOrderedIds(props.rows.map((r) => String(r.id)));
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
  const visibleRows =
    search || filters
      ? orderedRows.filter((row) => {
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
              const selected = filterValues[filter.field] ?? '';
              return (
                selected.length === 0 || String(row[filter.field]) === selected
              );
            });
          return matchesSearch && matchesFilters;
        })
      : orderedRows;
  const emptyRow = search ? (
    <TableRow>
      <TableCell
        className="px-4 py-6 text-sm text-muted-foreground"
        colSpan={displayColumns.length + (canDragReorder ? 2 : 1)}
      >
        {t(search.emptyKey)}
      </TableCell>
    </TableRow>
  ) : null;

  function renderCells(row: CatalogRow) {
    const cols = displayColumns.map((col) => {
      const nameRaw = row.name;
      const listNameEditHref =
        col.field === 'name' &&
        canUpdate &&
        typeof nameRaw === 'string' &&
        nameRaw.trim().length > 0
          ? primaryHref(String(row.id))
          : undefined;
      return (
        <TableCell
          key={col.field}
          className="block min-w-0 px-4 py-2 text-foreground md:table-cell md:py-3"
        >
          <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
            {t(col.headerKey)}
          </span>
          <AdminCatalogListCell
            booleanPolarity={col.booleanPolarity}
            field={col.field}
            kind={col.kind}
            listNameEditHref={listNameEditHref}
            row={row}
          />
        </TableCell>
      );
    });
    const viewHref = publicViewHref(row);
    const actions = (
      <TableCell className="block min-w-0 px-4 pt-2 pb-4 md:table-cell md:py-3">
        <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
          {t('column_actions')}
        </span>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {viewHref ? (
            <Link
              className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-white"
              href={viewHref}
            >
              {t('action_view_page')}
            </Link>
          ) : null}
          {canUpdate ? (
            <Link
              className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
              href={editHref(String(row.id))}
            >
              {t('action_edit')}
            </Link>
          ) : null}
          {canDelete ? (
            <Link
              className="text-sm font-medium text-mit-red no-underline hover:underline dark:text-mit-red-ink"
              href={deleteHref(String(row.id))}
            >
              {t('action_delete')}
            </Link>
          ) : null}
          {props.userImpersonation &&
          String(row.id) === props.userImpersonation.currentUserId ? (
            <span className="text-xs text-mit-text">
              {props.userImpersonation.selfLabel}
            </span>
          ) : null}
          {props.userImpersonation &&
          String(row.id) !== props.userImpersonation.currentUserId ? (
            <ImpersonateButtonClient
              redirectHref={props.userImpersonation.accountRedirectHref}
              userId={String(row.id)}
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
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={(event) => {
            // eslint-disable-next-line no-void -- JSX handlers stay synchronous while discarding the reorder promise.
            void handleDragEnd(event);
          }}
          sensors={sensors}
        >
          <div className="rounded-lg border border-border bg-card">
            <Table className="text-left md:min-w-[720px]">
              <TableHeader className="hidden md:table-header-group">
                <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                  <TableHead
                    aria-label={t('drag_handle_aria')}
                    className="w-10 px-2 py-3"
                  />
                  {displayColumns.map((col) => (
                    <TableHead
                      key={col.field}
                      className="px-4 py-3 font-medium"
                    >
                      {t(col.headerKey)}
                    </TableHead>
                  ))}
                  <TableHead className="px-4 py-3 font-medium">
                    {t('column_actions')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <SortableContext
                items={orderedIds}
                strategy={verticalListSortingStrategy}
              >
                <TableBody>
                  {visibleRows.length === 0
                    ? emptyRow
                    : visibleRows.map((row) => (
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
          </div>
        </DndContext>
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table className="text-left md:min-w-[720px]">
            <TableHeader className="hidden md:table-header-group">
              <TableRow className="border-b bg-muted/50 hover:bg-muted/50">
                {displayColumns.map((col) => (
                  <TableHead key={col.field} className="px-4 py-3 font-medium">
                    {t(col.headerKey)}
                  </TableHead>
                ))}
                <TableHead className="px-4 py-3 font-medium">
                  {t('column_actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.length === 0
                ? emptyRow
                : visibleRows.map((row) => (
                    <StaticRow key={String(row.id)}>
                      {renderCells(row)}
                    </StaticRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
