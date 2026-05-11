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
  /** Message bundle for column headers and actions (default catalog resource). */
  messageNamespace?: 'AdminCatalogResource' | 'AdminUsers';
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
  /* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- column keys come from the definition matched to `messageNamespace` */
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

  const [orderedIds, setOrderedIds] = useState<string[]>(() =>
    props.rows.map((r) => String(r.id))
  );
  const [reorderError, setReorderError] = useState<string | null>(null);

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

  function renderCells(row: CatalogRow) {
    const cols = displayColumns.map((col) => {
      const nameRaw = row.name;
      const listNameEditHref =
        col.field === 'name' &&
        canUpdate &&
        typeof nameRaw === 'string' &&
        nameRaw.trim().length > 0
          ? editHref(String(row.id))
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
            messageNamespace={props.messageNamespace}
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
              className="text-sm font-medium text-mit-red-ink no-underline hover:underline"
              href={viewHref}
            >
              {t('action_view_page')}
            </Link>
          ) : null}
          <Link
            className="text-sm font-medium text-mit-red-ink no-underline hover:underline"
            href={editHref(String(row.id))}
          >
            {t('action_edit')}
          </Link>
          <Link
            className="text-sm font-medium text-mit-red-ink no-underline hover:underline"
            href={deleteHref(String(row.id))}
          >
            {t('action_delete')}
          </Link>
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
      {reorderError ? (
        <p className="text-sm text-destructive" role="alert">
          {reorderError}
        </p>
      ) : null}

      {canReorder ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
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
                  {orderedRows.map((row) => (
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
              {orderedRows.map((row) => (
                <StaticRow key={String(row.id)}>{renderCells(row)}</StaticRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
