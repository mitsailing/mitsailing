import 'server-only';
import { Prisma } from '@/generated/prisma/client';
import {
  adminCatalogResourceVersionComparePath,
  adminCatalogResourceVersionPath,
} from '@/libs/admin/catalog/adminCatalogPaths';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import {
  catalogSnapshotFromRow,
  catalogSnapshotFromUnknown,
} from '@/libs/admin/catalog/catalogVersionSnapshots';
import type {
  CatalogChangeAction,
  CatalogEditChange,
  CatalogEditContributor,
  CatalogEditMetadata,
  CatalogEditVersion,
  CatalogResourceDefinition,
  CatalogRow,
} from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

type CatalogChangeLogProps = {
  resourceId: CatalogResourceId;
  rowId: string;
  action: CatalogChangeAction;
  userId: string;
  snapshot: CatalogRow | null;
};

function rowString(row: CatalogRow, key: string): string | null {
  const value = row[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function contributorFromRow(
  row: CatalogRow,
  nameKey: string,
  emailKey: string
): CatalogEditContributor | null {
  const name = rowString(row, nameKey);
  const email = rowString(row, emailKey);
  const displayName = name ?? email;
  if (!displayName) {
    return null;
  }
  return { name: displayName, email };
}

function contributorFromChange(
  change: CatalogEditChange | undefined
): CatalogEditContributor | null {
  const name = change?.editorName ?? change?.editorEmail;
  if (!name) {
    return null;
  }
  return { name, email: change?.editorEmail ?? null };
}

function changeActionFromDb(action: string): CatalogChangeAction {
  if (action === 'created' || action === 'deleted' || action === 'restored') {
    return action;
  }
  return 'updated';
}

function viewPageHrefForRow(props: {
  definition: CatalogResourceDefinition;
  locale: string;
  row: CatalogRow;
}): string | null {
  if (!props.definition.publicPreview) {
    return null;
  }
  const slug = rowString(props.row, 'slug');
  const path = slug
    ? `${props.definition.publicPreview.path}${slug}/`
    : props.definition.publicPreview.path;
  return getI18nPath(path, props.locale);
}

/**
 * Records a catalog edit and optional whole-row snapshot.
 *
 * @param props - Resource row, actor, and action
 */
export async function logCatalogChange(
  props: CatalogChangeLogProps
): Promise<void> {
  await prisma.catalogChangeLog.create({
    data: {
      resourceId: props.resourceId,
      rowId: props.rowId,
      action: props.action,
      userId: props.userId,
      snapshot: props.snapshot
        ? catalogSnapshotFromRow(props.snapshot)
        : Prisma.DbNull,
    },
  });
}

/**
 * Fetches recent editor attribution for a catalog row.
 *
 * @param resourceId - Registered catalog resource id
 * @param rowId - Catalog row primary key
 * @param locale - Active locale for generated version links
 * @returns Most recent catalog changes
 */
export async function getRecentCatalogChanges(
  resourceId: CatalogResourceId,
  rowId: string,
  locale: string
): Promise<readonly CatalogEditChange[]> {
  const rows = await prisma.catalogChangeLog.findMany({
    where: { resourceId, rowId },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: {
      id: true,
      action: true,
      createdAt: true,
      snapshot: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    action: changeActionFromDb(row.action),
    editorName: row.user?.name ?? row.user?.email ?? null,
    editorEmail: row.user?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    canRestore: row.snapshot !== null,
    viewHref:
      row.snapshot === null
        ? null
        : getI18nPath(
            adminCatalogResourceVersionPath(resourceId, rowId, row.id),
            locale
          ),
    compareHref:
      row.snapshot === null
        ? null
        : getI18nPath(
            adminCatalogResourceVersionComparePath(resourceId, rowId, row.id),
            locale
          ),
  }));
}

/**
 * Fetches one restorable catalog version snapshot.
 *
 * @param props - Resource, row, change id, and locale
 * @returns Version detail when a snapshot exists
 */
export async function getCatalogChangeVersion(props: {
  resourceId: CatalogResourceId;
  rowId: string;
  changeId: string;
  locale: string;
}): Promise<CatalogEditVersion | null> {
  const row = await prisma.catalogChangeLog.findFirst({
    where: {
      id: props.changeId,
      resourceId: props.resourceId,
      rowId: props.rowId,
    },
    select: {
      id: true,
      action: true,
      createdAt: true,
      snapshot: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
  });
  if (!row) {
    return null;
  }
  const snapshot = catalogSnapshotFromUnknown(row.snapshot);
  if (!snapshot) {
    return null;
  }
  return {
    id: row.id,
    action: changeActionFromDb(row.action),
    editorName: row.user?.name ?? row.user?.email ?? null,
    editorEmail: row.user?.email ?? null,
    createdAt: row.createdAt.toISOString(),
    canRestore: true,
    viewHref: getI18nPath(
      adminCatalogResourceVersionPath(props.resourceId, props.rowId, row.id),
      props.locale
    ),
    compareHref: getI18nPath(
      adminCatalogResourceVersionComparePath(
        props.resourceId,
        props.rowId,
        row.id
      ),
      props.locale
    ),
    snapshot,
  };
}

/**
 * Builds display-ready edit metadata from serialized catalog row fields.
 *
 * @param props - Definition, locale, row, and recent change rows
 * @returns Metadata when the row exposes creator/editor fields
 */
export function catalogEditMetadataFromRow(props: {
  definition: CatalogResourceDefinition;
  locale: string;
  row: CatalogRow;
  recentChanges: readonly CatalogEditChange[];
}): CatalogEditMetadata | null {
  const createdBy = contributorFromRow(
    props.row,
    'createdByName',
    'createdByEmail'
  );
  const lastEditedBy =
    contributorFromRow(props.row, 'updatedByName', 'updatedByEmail') ??
    contributorFromChange(props.recentChanges[0]);
  const createdAt = rowString(props.row, 'createdAt');
  const lastEditedAt =
    rowString(props.row, 'updatedAt') ??
    props.recentChanges[0]?.createdAt ??
    createdAt;
  const { isVisible } = props.row;
  return {
    createdBy,
    createdAt,
    lastEditedBy,
    lastEditedAt,
    isPublished: typeof isVisible === 'boolean' ? isVisible : null,
    renderedAt: new Date().toISOString(),
    recentChanges: props.recentChanges,
    viewPageHref: viewPageHrefForRow({
      definition: props.definition,
      locale: props.locale,
      row: props.row,
    }),
  };
}
