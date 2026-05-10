import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import type { CatalogMutationContext } from '@/libs/admin/catalog/types';
import { prisma } from '@/libs/DB';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';

export type CatalogHistoryResourceId = 'fleet' | 'sailing_classes';

export type CatalogRevisionAction = 'create' | 'delete' | 'restore' | 'update';

const HISTORY_LIST_LIMIT = 20;
const HISTORY_SUMMARY_CHANGE_LIMIT = 3;

export type AdminCatalogRevision = {
  id: string;
  version: number;
  action: CatalogRevisionAction;
  createdAt: string;
  editorName?: string;
  editorEmail?: string;
  preview: {
    title?: string;
    subtitle?: string;
    excerpt?: string;
  };
  summary: AdminCatalogRevisionSummary;
};

export type AdminCatalogRevisionChangeValue =
  | { kind: 'empty' }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string };

export type AdminCatalogRevisionChange = {
  field: string;
  before: AdminCatalogRevisionChangeValue;
  after: AdminCatalogRevisionChangeValue;
};

export type AdminCatalogRevisionSummary =
  | { kind: 'created' }
  | { kind: 'empty' }
  | {
      kind: 'changes';
      changes: { field: string }[];
      remainingCount: number;
    };

export type AdminCatalogRevisionComparison = {
  baseVersion?: number;
  changes: AdminCatalogRevisionChange[];
  remainingCount: number;
};

export type AdminCatalogRevisionCompare = AdminCatalogRevision & {
  resourceId: CatalogHistoryResourceId;
  baseVersion?: number;
  comparison: AdminCatalogRevisionComparison;
};

export type CatalogRevisionRestoreResult =
  | { ok: true; slug: string }
  | { ok: false; code: 'invalid_resource' | 'invalid_snapshot' | 'not_found' };

type SailingClassAuditSnapshot = {
  resource: 'sailing_classes';
  id: string;
  name: string;
  slug: string;
  classCategoryId: string;
  classCategoryName: string;
  level: string;
  description: string;
  imagePaths: string[];
  isVisible: boolean;
};

type FleetAuditSnapshot = {
  resource: 'fleet';
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  requiredClassId: string;
  requiredClassName: string;
  description: string;
  imagePaths: string[];
};

type CatalogAuditSnapshot = SailingClassAuditSnapshot | FleetAuditSnapshot;

const CATALOG_AUDIT_RESOURCE_IDS = [
  'fleet',
  'sailing_classes',
] as const satisfies readonly CatalogResourceId[];

export function isCatalogHistoryResourceId(
  resourceId: CatalogResourceId
): resourceId is CatalogHistoryResourceId {
  return CATALOG_AUDIT_RESOURCE_IDS.some((id) => id === resourceId);
}

function propertyFromUnknown(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.getOwnPropertyDescriptor(value, key)?.value;
  }
  return undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function nullableStringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function booleanFromUnknown(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringArrayFromUnknown(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter(
    (item): item is string => typeof item === 'string'
  );
  return strings.length === value.length ? strings : undefined;
}

function catalogAuditSnapshotFromUnknown(
  value: unknown
): CatalogAuditSnapshot | null {
  const resource = propertyFromUnknown(value, 'resource');
  const id = stringFromUnknown(propertyFromUnknown(value, 'id'));
  const name = stringFromUnknown(propertyFromUnknown(value, 'name'));
  const slug = stringFromUnknown(propertyFromUnknown(value, 'slug'));
  const description = nullableStringFromUnknown(
    propertyFromUnknown(value, 'description')
  );
  const imagePaths = stringArrayFromUnknown(
    propertyFromUnknown(value, 'imagePaths')
  );
  if (!id || !name || !slug || description === undefined || !imagePaths) {
    return null;
  }

  if (resource === 'sailing_classes') {
    const classCategoryId = stringFromUnknown(
      propertyFromUnknown(value, 'classCategoryId')
    );
    const classCategoryName = stringFromUnknown(
      propertyFromUnknown(value, 'classCategoryName')
    );
    const level = stringFromUnknown(propertyFromUnknown(value, 'level'));
    const isVisible = booleanFromUnknown(
      propertyFromUnknown(value, 'isVisible')
    );
    if (
      !classCategoryId ||
      !classCategoryName ||
      !level ||
      isVisible === undefined
    ) {
      return null;
    }
    return {
      classCategoryId,
      classCategoryName,
      description,
      id,
      imagePaths,
      isVisible,
      level,
      name,
      resource,
      slug,
    };
  }

  if (resource === 'fleet') {
    const type = stringFromUnknown(propertyFromUnknown(value, 'type'));
    const capacity = numberFromUnknown(propertyFromUnknown(value, 'capacity'));
    const requiredClassId = stringFromUnknown(
      propertyFromUnknown(value, 'requiredClassId')
    );
    const requiredClassName = stringFromUnknown(
      propertyFromUnknown(value, 'requiredClassName')
    );
    if (
      !type ||
      capacity === undefined ||
      !requiredClassId ||
      !requiredClassName
    ) {
      return null;
    }
    return {
      capacity,
      description,
      id,
      imagePaths,
      name,
      requiredClassId,
      requiredClassName,
      resource,
      slug,
      type,
    };
  }

  return null;
}

function textChangeValue(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized
    ? ({ kind: 'text', value: normalized } as const)
    : ({ kind: 'empty' } as const);
}

function richTextChangeValue(value: string | null | undefined) {
  return textChangeValue(plainTextFromCmsRichTextHtml(value));
}

function booleanChangeValue(value: boolean) {
  return { kind: 'boolean', value } as const;
}

function numberChangeValue(value: number) {
  return { kind: 'number', value } as const;
}

function imagePathsChangeValue(value: readonly string[]) {
  return textChangeValue(value.join('\n'));
}

function changeValuesEqual(
  a: AdminCatalogRevisionChangeValue,
  b: AdminCatalogRevisionChangeValue
): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.kind === 'empty') {
    return true;
  }
  if (a.kind === 'boolean') {
    return b.kind === 'boolean' && a.value === b.value;
  }
  if (a.kind === 'number') {
    return b.kind === 'number' && a.value === b.value;
  }
  return b.kind === 'text' && a.value === b.value;
}

function addFieldChange(
  changes: AdminCatalogRevisionChange[],
  field: string,
  before: AdminCatalogRevisionChangeValue,
  after: AdminCatalogRevisionChangeValue
): void {
  if (!changeValuesEqual(before, after)) {
    changes.push({ after, before, field });
  }
}

function compareCatalogAuditSnapshots(
  before: CatalogAuditSnapshot | null,
  after: CatalogAuditSnapshot | null,
  baseVersion?: number
): AdminCatalogRevisionComparison {
  const changes: AdminCatalogRevisionChange[] = [];
  if (!before || !after || before.resource !== after.resource) {
    return { baseVersion, changes, remainingCount: 0 };
  }

  addFieldChange(
    changes,
    'name',
    textChangeValue(before.name),
    textChangeValue(after.name)
  );
  addFieldChange(
    changes,
    'slug',
    textChangeValue(before.slug),
    textChangeValue(after.slug)
  );
  addFieldChange(
    changes,
    'description',
    richTextChangeValue(before.description),
    richTextChangeValue(after.description)
  );
  addFieldChange(
    changes,
    'imagePaths',
    imagePathsChangeValue(before.imagePaths),
    imagePathsChangeValue(after.imagePaths)
  );

  if (
    before.resource === 'sailing_classes' &&
    after.resource === 'sailing_classes'
  ) {
    addFieldChange(
      changes,
      'classCategoryId',
      textChangeValue(before.classCategoryName),
      textChangeValue(after.classCategoryName)
    );
    addFieldChange(
      changes,
      'level',
      textChangeValue(before.level),
      textChangeValue(after.level)
    );
    addFieldChange(
      changes,
      'isVisible',
      booleanChangeValue(before.isVisible),
      booleanChangeValue(after.isVisible)
    );
  }

  if (before.resource === 'fleet' && after.resource === 'fleet') {
    addFieldChange(
      changes,
      'type',
      textChangeValue(before.type),
      textChangeValue(after.type)
    );
    addFieldChange(
      changes,
      'capacity',
      numberChangeValue(before.capacity),
      numberChangeValue(after.capacity)
    );
    addFieldChange(
      changes,
      'requiredClassId',
      textChangeValue(before.requiredClassName),
      textChangeValue(after.requiredClassName)
    );
  }

  const shownChanges = changes.slice(0, 8);
  return {
    baseVersion,
    changes: shownChanges,
    remainingCount: changes.length - shownChanges.length,
  };
}

function catalogRevisionSummary(props: {
  action: CatalogRevisionAction;
  previousSnapshot: CatalogAuditSnapshot | null;
  snapshot: CatalogAuditSnapshot | null;
}): AdminCatalogRevisionSummary {
  if (props.action === 'create') {
    return { kind: 'created' };
  }
  const comparison = compareCatalogAuditSnapshots(
    props.previousSnapshot,
    props.snapshot
  );
  const shownChanges = comparison.changes.slice(
    0,
    HISTORY_SUMMARY_CHANGE_LIMIT
  );
  if (shownChanges.length === 0 && comparison.remainingCount === 0) {
    return { kind: 'empty' };
  }
  return {
    changes: shownChanges.map((change) => ({ field: change.field })),
    kind: 'changes',
    remainingCount:
      comparison.remainingCount +
      comparison.changes.length -
      shownChanges.length,
  };
}

function catalogAuditSnapshotsEqual(
  a: CatalogAuditSnapshot,
  b: CatalogAuditSnapshot
): boolean {
  const comparison = compareCatalogAuditSnapshots(a, b);
  return comparison.changes.length === 0 && comparison.remainingCount === 0;
}

function catalogAuditSnapshotsHaveSameContent(a: unknown, b: unknown): boolean {
  const aSnapshot = catalogAuditSnapshotFromUnknown(a);
  const bSnapshot = catalogAuditSnapshotFromUnknown(b);
  return Boolean(
    aSnapshot && bSnapshot && catalogAuditSnapshotsEqual(aSnapshot, bSnapshot)
  );
}

function catalogAuditSnapshotJson(
  snapshot: CatalogAuditSnapshot
): Prisma.InputJsonObject {
  if (snapshot.resource === 'sailing_classes') {
    return {
      classCategoryId: snapshot.classCategoryId,
      classCategoryName: snapshot.classCategoryName,
      description: snapshot.description,
      id: snapshot.id,
      imagePaths: snapshot.imagePaths,
      isVisible: snapshot.isVisible,
      level: snapshot.level,
      name: snapshot.name,
      resource: snapshot.resource,
      slug: snapshot.slug,
    };
  }
  return {
    capacity: snapshot.capacity,
    description: snapshot.description,
    id: snapshot.id,
    imagePaths: snapshot.imagePaths,
    name: snapshot.name,
    requiredClassId: snapshot.requiredClassId,
    requiredClassName: snapshot.requiredClassName,
    resource: snapshot.resource,
    slug: snapshot.slug,
    type: snapshot.type,
  };
}

function catalogRevisionPreview(
  snapshot: unknown
): AdminCatalogRevision['preview'] {
  const parsed = catalogAuditSnapshotFromUnknown(snapshot);
  if (!parsed) {
    return {};
  }
  return {
    excerpt: plainTextFromCmsRichTextHtml(parsed.description),
    subtitle:
      parsed.resource === 'sailing_classes'
        ? parsed.classCategoryName
        : parsed.requiredClassName,
    title: parsed.name,
  };
}

function auditUserData(context?: CatalogMutationContext) {
  return {
    impersonatedUserId: context?.impersonatedUserId ?? null,
    userId: context?.userId ?? null,
  };
}

export async function loadCatalogRevisionSnapshot(props: {
  itemId: string;
  resourceId: CatalogHistoryResourceId;
}): Promise<Prisma.InputJsonObject | null> {
  if (props.resourceId === 'sailing_classes') {
    const row = await prisma.sailingClass.findUnique({
      where: { id: props.itemId },
      select: {
        id: true,
        name: true,
        slug: true,
        classCategoryId: true,
        classCategory: { select: { name: true } },
        level: true,
        description: true,
        imagePaths: true,
        isVisible: true,
      },
    });
    return row
      ? catalogAuditSnapshotJson({
          classCategoryId: row.classCategoryId,
          classCategoryName: row.classCategory.name,
          description: row.description,
          id: row.id,
          imagePaths: row.imagePaths,
          isVisible: row.isVisible,
          level: row.level,
          name: row.name,
          resource: props.resourceId,
          slug: row.slug,
        })
      : null;
  }

  const row = await prisma.fleetBoat.findUnique({
    where: { id: props.itemId },
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      capacity: true,
      requiredClassId: true,
      requiredClass: { select: { name: true } },
      description: true,
      imagePaths: true,
    },
  });
  return row
    ? catalogAuditSnapshotJson({
        capacity: row.capacity,
        description: row.description,
        id: row.id,
        imagePaths: row.imagePaths,
        name: row.name,
        requiredClassId: row.requiredClassId,
        requiredClassName: row.requiredClass.name,
        resource: props.resourceId,
        slug: row.slug,
        type: row.type,
      })
    : null;
}

export async function recordCatalogRevisionFromSnapshot(props: {
  action: CatalogRevisionAction;
  itemId: string;
  resourceId: CatalogHistoryResourceId;
  snapshot: Prisma.InputJsonObject;
  context?: CatalogMutationContext;
}): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const latestRevision = await tx.userAudit.findFirst({
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: { auditedChanges: true, version: true },
        where: {
          auditableId: props.itemId,
          auditableType: props.resourceId,
        },
      });
      const latestSnapshot = catalogAuditSnapshotFromUnknown(
        latestRevision?.auditedChanges
      );
      const nextSnapshot = catalogAuditSnapshotFromUnknown(props.snapshot);
      if (
        props.action === 'update' &&
        latestSnapshot &&
        nextSnapshot &&
        catalogAuditSnapshotsEqual(latestSnapshot, nextSnapshot)
      ) {
        return;
      }
      await tx.userAudit.create({
        data: {
          action: props.action,
          auditableId: props.itemId,
          auditableType: props.resourceId,
          auditedChanges: props.snapshot,
          ...auditUserData(props.context),
          version: (latestRevision?.version ?? 0) + 1,
        },
      });
    },
    { isolationLevel: 'Serializable' }
  );
}

export async function recordCatalogRevision(props: {
  action: CatalogRevisionAction;
  itemId: string;
  resourceId: CatalogHistoryResourceId;
  context?: CatalogMutationContext;
}): Promise<void> {
  const snapshot = await loadCatalogRevisionSnapshot({
    itemId: props.itemId,
    resourceId: props.resourceId,
  });
  if (!snapshot) {
    return;
  }
  await recordCatalogRevisionFromSnapshot({
    action: props.action,
    context: props.context,
    itemId: props.itemId,
    resourceId: props.resourceId,
    snapshot,
  });
}

export async function recordCatalogRevisionIfChanged(props: {
  action: CatalogRevisionAction;
  itemId: string;
  previousSnapshot: Prisma.InputJsonObject | null;
  resourceId: CatalogHistoryResourceId;
  context?: CatalogMutationContext;
}): Promise<void> {
  const snapshot = await loadCatalogRevisionSnapshot({
    itemId: props.itemId,
    resourceId: props.resourceId,
  });
  if (!snapshot) {
    return;
  }
  if (
    props.previousSnapshot &&
    catalogAuditSnapshotsHaveSameContent(props.previousSnapshot, snapshot)
  ) {
    return;
  }
  await recordCatalogRevisionFromSnapshot({
    action: props.action,
    context: props.context,
    itemId: props.itemId,
    resourceId: props.resourceId,
    snapshot,
  });
}

export async function listAdminCatalogRevisions(props: {
  itemId: string;
  resourceId: CatalogHistoryResourceId;
}): Promise<AdminCatalogRevision[]> {
  const revisions = await prisma.userAudit.findMany({
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    select: {
      action: true,
      auditedChanges: true,
      createdAt: true,
      id: true,
      user: { select: { email: true, name: true } },
      version: true,
    },
    take: HISTORY_LIST_LIMIT + 1,
    where: {
      auditableId: props.itemId,
      auditableType: props.resourceId,
    },
  });
  const revisionSnapshots = revisions.map((revision) => ({
    revision,
    snapshot: catalogAuditSnapshotFromUnknown(revision.auditedChanges),
  }));
  return revisionSnapshots.slice(0, HISTORY_LIST_LIMIT).map((entry, index) => ({
    action: entry.revision.action,
    createdAt: entry.revision.createdAt.toISOString(),
    editorEmail: entry.revision.user?.email,
    editorName: entry.revision.user?.name,
    id: entry.revision.id,
    preview: catalogRevisionPreview(entry.revision.auditedChanges),
    summary: catalogRevisionSummary({
      action: entry.revision.action,
      previousSnapshot: revisionSnapshots[index + 1]?.snapshot ?? null,
      snapshot: entry.snapshot,
    }),
    version: entry.revision.version,
  }));
}

export async function getAdminCatalogRevisionCompare(props: {
  itemId: string;
  resourceId: CatalogHistoryResourceId;
  revisionId: string;
}): Promise<AdminCatalogRevisionCompare | null> {
  const [currentSnapshotValue, revision] = await Promise.all([
    loadCatalogRevisionSnapshot({
      itemId: props.itemId,
      resourceId: props.resourceId,
    }),
    prisma.userAudit.findFirst({
      select: {
        action: true,
        auditedChanges: true,
        createdAt: true,
        id: true,
        user: { select: { email: true, name: true } },
        version: true,
      },
      where: {
        auditableId: props.itemId,
        auditableType: props.resourceId,
        id: props.revisionId,
      },
    }),
  ]);
  if (!revision) {
    return null;
  }
  const previousRevision = await prisma.userAudit.findFirst({
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    select: {
      auditedChanges: true,
      version: true,
    },
    where: {
      auditableId: props.itemId,
      auditableType: props.resourceId,
      version: { lt: revision.version },
    },
  });
  const baseSnapshot = previousRevision
    ? catalogAuditSnapshotFromUnknown(previousRevision.auditedChanges)
    : catalogAuditSnapshotFromUnknown(currentSnapshotValue);
  const snapshot = catalogAuditSnapshotFromUnknown(revision.auditedChanges);
  return {
    action: revision.action,
    baseVersion: previousRevision?.version,
    comparison: compareCatalogAuditSnapshots(
      baseSnapshot,
      snapshot,
      previousRevision?.version
    ),
    createdAt: revision.createdAt.toISOString(),
    editorEmail: revision.user?.email,
    editorName: revision.user?.name,
    id: revision.id,
    preview: catalogRevisionPreview(revision.auditedChanges),
    resourceId: props.resourceId,
    summary: catalogRevisionSummary({
      action: revision.action,
      previousSnapshot: baseSnapshot,
      snapshot,
    }),
    version: revision.version,
  };
}

export async function restoreCatalogRevision(props: {
  context?: CatalogMutationContext;
  itemId: string;
  resourceId: CatalogHistoryResourceId;
  revisionId: string;
}): Promise<CatalogRevisionRestoreResult> {
  const revision = await prisma.userAudit.findFirst({
    select: { auditedChanges: true },
    where: {
      auditableId: props.itemId,
      auditableType: props.resourceId,
      id: props.revisionId,
    },
  });
  if (!revision) {
    return { ok: false, code: 'not_found' };
  }
  const snapshot = catalogAuditSnapshotFromUnknown(revision.auditedChanges);
  if (
    !snapshot ||
    snapshot.id !== props.itemId ||
    snapshot.resource !== props.resourceId
  ) {
    return { ok: false, code: 'invalid_snapshot' };
  }

  if (
    props.resourceId === 'sailing_classes' &&
    snapshot.resource === 'sailing_classes'
  ) {
    await prisma.sailingClass.update({
      data: {
        classCategoryId: snapshot.classCategoryId,
        description: snapshot.description,
        imagePaths: snapshot.imagePaths,
        isVisible: snapshot.isVisible,
        level: snapshot.level,
        name: snapshot.name,
        slug: snapshot.slug,
      },
      where: { id: props.itemId },
    });
  } else if (props.resourceId === 'fleet' && snapshot.resource === 'fleet') {
    await prisma.fleetBoat.update({
      data: {
        capacity: snapshot.capacity,
        description: snapshot.description,
        imagePaths: snapshot.imagePaths,
        name: snapshot.name,
        requiredClassId: snapshot.requiredClassId,
        slug: snapshot.slug,
        type: snapshot.type,
      },
      where: { id: props.itemId },
    });
  } else {
    return { ok: false, code: 'invalid_resource' };
  }

  await recordCatalogRevision({
    action: 'restore',
    context: props.context,
    itemId: props.itemId,
    resourceId: props.resourceId,
  });
  return { ok: true, slug: snapshot.slug };
}
