import 'server-only';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { plainTextFromCmsRichTextHtml } from '@/libs/mit-sailing/cmsRichText';

const CMS_PAGE_HISTORY_SELECT = {
  id: true,
  slug: true,
  path: true,
  title: true,
  metaTitle: true,
  metaDescription: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  blocks: {
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      kind: true,
      title: true,
      subtitle: true,
      body: true,
      ctaLabel: true,
      ctaUrl: true,
      imageSrc: true,
      imageAlt: true,
      displayOrder: true,
      isVisible: true,
      createdAt: true,
      updatedAt: true,
    },
  },
} satisfies Prisma.CmsPageSelect;

type CmsPageHistoryRow = Prisma.CmsPageGetPayload<{
  select: typeof CMS_PAGE_HISTORY_SELECT;
}>;

export type CmsPageRevisionAction = 'create' | 'update' | 'delete';

export type AdminCmsPageRevision = {
  id: string;
  version: number;
  action: CmsPageRevisionAction;
  createdAt: string;
  editorName?: string;
  editorEmail?: string;
  preview: {
    blockCount: number;
    excerpt?: string;
    pagePath?: string;
    pageTitle?: string;
  };
};

type CmsPageRevisionBlockKind =
  | 'hero'
  | 'text_section'
  | 'callout'
  | 'pricing'
  | 'home_overview';

type CmsPageRevisionSnapshotPage = {
  id: string;
  slug: string;
  path: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
};

type CmsPageRevisionSnapshotBlock = {
  id: string;
  kind: CmsPageRevisionBlockKind;
  title: string;
  subtitle: string | null;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  imageSrc: string | null;
  imageAlt: string | null;
  displayOrder: number;
  isVisible: boolean;
};

type CmsPageRevisionSnapshot = {
  page: CmsPageRevisionSnapshotPage;
  blocks: CmsPageRevisionSnapshotBlock[];
};

export type AdminCmsPageRevisionChangeValue =
  | { kind: 'empty' }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'number'; value: number }
  | { kind: 'text'; value: string };

export type AdminCmsPageRevisionPageField =
  | 'isPublished'
  | 'metaDescription'
  | 'metaTitle'
  | 'path'
  | 'slug'
  | 'title';

export type AdminCmsPageRevisionBlockField =
  | 'body'
  | 'ctaLabel'
  | 'ctaUrl'
  | 'displayOrder'
  | 'imageAlt'
  | 'imageSrc'
  | 'isVisible'
  | 'kind'
  | 'subtitle'
  | 'title';

export type AdminCmsPageRevisionChange =
  | {
      kind: 'page_field';
      field: AdminCmsPageRevisionPageField;
      before: AdminCmsPageRevisionChangeValue;
      after: AdminCmsPageRevisionChangeValue;
    }
  | {
      kind: 'block_field';
      blockTitle: string;
      field: AdminCmsPageRevisionBlockField;
      before: AdminCmsPageRevisionChangeValue;
      after: AdminCmsPageRevisionChangeValue;
    }
  | {
      kind: 'block_added';
      blockTitle: string;
    }
  | {
      kind: 'block_removed';
      blockTitle: string;
    };

export type AdminCmsPageRevisionComparison = {
  baseVersion?: number;
  changes: AdminCmsPageRevisionChange[];
  remainingCount: number;
};

export type AdminCmsPageRevisionCompare = AdminCmsPageRevision & {
  baseVersion?: number;
  comparison: AdminCmsPageRevisionComparison;
};

export type CmsPageRevisionRestoreResult =
  | { ok: true }
  | { ok: false; code: 'invalid_snapshot' | 'not_found' };

function propertyFromUnknown(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.getOwnPropertyDescriptor(value, key)?.value;
  }
  return undefined;
}

function booleanFromUnknown(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function numberFromUnknown(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function nullableStringFromUnknown(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }
  return typeof value === 'string' ? value : undefined;
}

function blockKindFromUnknown(
  value: unknown
): CmsPageRevisionBlockKind | undefined {
  return value === 'hero' ||
    value === 'text_section' ||
    value === 'callout' ||
    value === 'pricing' ||
    value === 'home_overview'
    ? value
    : undefined;
}

function cmsPageRevisionPreview(
  snapshot: unknown
): AdminCmsPageRevision['preview'] {
  const page = propertyFromUnknown(snapshot, 'page');
  const blocksValue = propertyFromUnknown(snapshot, 'blocks');
  const blocks = Array.isArray(blocksValue) ? blocksValue : [];
  const firstBlock = blocks.find(
    (block) =>
      typeof block === 'object' && block !== null && !Array.isArray(block)
  );
  const body = plainTextFromCmsRichTextHtml(
    stringFromUnknown(propertyFromUnknown(firstBlock, 'body'))
  );
  const subtitle = stringFromUnknown(
    propertyFromUnknown(firstBlock, 'subtitle')
  );
  const title = stringFromUnknown(propertyFromUnknown(firstBlock, 'title'));
  return {
    blockCount: blocks.length,
    excerpt: body ?? subtitle ?? title,
    pagePath: stringFromUnknown(propertyFromUnknown(page, 'path')),
    pageTitle: stringFromUnknown(propertyFromUnknown(page, 'title')),
  };
}

function cmsPageRevisionBlockFromUnknown(
  value: unknown
): CmsPageRevisionSnapshotBlock | null {
  const id = stringFromUnknown(propertyFromUnknown(value, 'id'));
  const kind = blockKindFromUnknown(propertyFromUnknown(value, 'kind'));
  const title = stringFromUnknown(propertyFromUnknown(value, 'title'));
  const displayOrder = numberFromUnknown(
    propertyFromUnknown(value, 'displayOrder')
  );
  const isVisible = booleanFromUnknown(propertyFromUnknown(value, 'isVisible'));
  if (
    !id ||
    !kind ||
    !title ||
    displayOrder === undefined ||
    isVisible === undefined
  ) {
    return null;
  }
  const subtitle = nullableStringFromUnknown(
    propertyFromUnknown(value, 'subtitle')
  );
  const body = nullableStringFromUnknown(propertyFromUnknown(value, 'body'));
  const ctaLabel = nullableStringFromUnknown(
    propertyFromUnknown(value, 'ctaLabel')
  );
  const ctaUrl = nullableStringFromUnknown(
    propertyFromUnknown(value, 'ctaUrl')
  );
  const imageSrc = nullableStringFromUnknown(
    propertyFromUnknown(value, 'imageSrc')
  );
  const imageAlt = nullableStringFromUnknown(
    propertyFromUnknown(value, 'imageAlt')
  );
  if (
    subtitle === undefined ||
    body === undefined ||
    ctaLabel === undefined ||
    ctaUrl === undefined ||
    imageSrc === undefined ||
    imageAlt === undefined
  ) {
    return null;
  }
  return {
    body,
    ctaLabel,
    ctaUrl,
    displayOrder,
    id,
    imageAlt,
    imageSrc,
    isVisible,
    kind,
    subtitle,
    title,
  };
}

function cmsPageRevisionSnapshotFromUnknown(
  value: unknown
): CmsPageRevisionSnapshot | null {
  const page = propertyFromUnknown(value, 'page');
  const blocksValue = propertyFromUnknown(value, 'blocks');
  const id = stringFromUnknown(propertyFromUnknown(page, 'id'));
  const slug = stringFromUnknown(propertyFromUnknown(page, 'slug'));
  const path = stringFromUnknown(propertyFromUnknown(page, 'path'));
  const title = stringFromUnknown(propertyFromUnknown(page, 'title'));
  const metaTitle = nullableStringFromUnknown(
    propertyFromUnknown(page, 'metaTitle')
  );
  const metaDescription = nullableStringFromUnknown(
    propertyFromUnknown(page, 'metaDescription')
  );
  const isPublished = booleanFromUnknown(
    propertyFromUnknown(page, 'isPublished')
  );
  if (
    !id ||
    !slug ||
    !path ||
    !title ||
    metaTitle === undefined ||
    metaDescription === undefined ||
    isPublished === undefined ||
    !Array.isArray(blocksValue)
  ) {
    return null;
  }
  const blocks: CmsPageRevisionSnapshotBlock[] = [];
  for (const blockValue of blocksValue) {
    const block = cmsPageRevisionBlockFromUnknown(blockValue);
    if (!block) {
      return null;
    }
    blocks.push(block);
  }
  return {
    blocks,
    page: {
      id,
      isPublished,
      metaDescription,
      metaTitle,
      path,
      slug,
      title,
    },
  };
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

function changeValuesEqual(
  a: AdminCmsPageRevisionChangeValue,
  b: AdminCmsPageRevisionChangeValue
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

function blockTitle(block: CmsPageRevisionSnapshotBlock): string {
  return block.title.trim() || block.id;
}

function addChange(
  changes: AdminCmsPageRevisionChange[],
  change: AdminCmsPageRevisionChange
): void {
  changes.push(change);
}

function comparePageField(
  changes: AdminCmsPageRevisionChange[],
  field: AdminCmsPageRevisionPageField,
  before: AdminCmsPageRevisionChangeValue,
  after: AdminCmsPageRevisionChangeValue
): void {
  if (!changeValuesEqual(before, after)) {
    addChange(changes, { after, before, field, kind: 'page_field' });
  }
}

function compareBlockField(
  changes: AdminCmsPageRevisionChange[],
  block: CmsPageRevisionSnapshotBlock,
  field: AdminCmsPageRevisionBlockField,
  before: AdminCmsPageRevisionChangeValue,
  after: AdminCmsPageRevisionChangeValue
): void {
  if (!changeValuesEqual(before, after)) {
    addChange(changes, {
      after,
      before,
      blockTitle: blockTitle(block),
      field,
      kind: 'block_field',
    });
  }
}

function compareCmsPageRevisionSnapshots(
  before: CmsPageRevisionSnapshot | null,
  after: CmsPageRevisionSnapshot | null,
  baseVersion?: number
): AdminCmsPageRevisionComparison {
  const changes: AdminCmsPageRevisionChange[] = [];
  if (!before || !after) {
    return { baseVersion, changes, remainingCount: 0 };
  }
  comparePageField(
    changes,
    'slug',
    textChangeValue(before.page.slug),
    textChangeValue(after.page.slug)
  );
  comparePageField(
    changes,
    'path',
    textChangeValue(before.page.path),
    textChangeValue(after.page.path)
  );
  comparePageField(
    changes,
    'title',
    textChangeValue(before.page.title),
    textChangeValue(after.page.title)
  );
  comparePageField(
    changes,
    'metaTitle',
    textChangeValue(before.page.metaTitle),
    textChangeValue(after.page.metaTitle)
  );
  comparePageField(
    changes,
    'metaDescription',
    textChangeValue(before.page.metaDescription),
    textChangeValue(after.page.metaDescription)
  );
  comparePageField(
    changes,
    'isPublished',
    booleanChangeValue(before.page.isPublished),
    booleanChangeValue(after.page.isPublished)
  );

  const beforeBlocks = new Map(before.blocks.map((block) => [block.id, block]));
  const afterBlocks = new Map(after.blocks.map((block) => [block.id, block]));
  for (const block of before.blocks) {
    if (!afterBlocks.has(block.id)) {
      addChange(changes, {
        blockTitle: blockTitle(block),
        kind: 'block_removed',
      });
    }
  }
  for (const block of after.blocks) {
    const previous = beforeBlocks.get(block.id);
    if (!previous) {
      addChange(changes, {
        blockTitle: blockTitle(block),
        kind: 'block_added',
      });
      continue;
    }
    compareBlockField(
      changes,
      block,
      'kind',
      textChangeValue(previous.kind),
      textChangeValue(block.kind)
    );
    compareBlockField(
      changes,
      block,
      'title',
      textChangeValue(previous.title),
      textChangeValue(block.title)
    );
    compareBlockField(
      changes,
      block,
      'subtitle',
      textChangeValue(previous.subtitle),
      textChangeValue(block.subtitle)
    );
    compareBlockField(
      changes,
      block,
      'body',
      richTextChangeValue(previous.body),
      richTextChangeValue(block.body)
    );
    compareBlockField(
      changes,
      block,
      'ctaLabel',
      textChangeValue(previous.ctaLabel),
      textChangeValue(block.ctaLabel)
    );
    compareBlockField(
      changes,
      block,
      'ctaUrl',
      textChangeValue(previous.ctaUrl),
      textChangeValue(block.ctaUrl)
    );
    compareBlockField(
      changes,
      block,
      'imageSrc',
      textChangeValue(previous.imageSrc),
      textChangeValue(block.imageSrc)
    );
    compareBlockField(
      changes,
      block,
      'imageAlt',
      textChangeValue(previous.imageAlt),
      textChangeValue(block.imageAlt)
    );
    compareBlockField(
      changes,
      block,
      'displayOrder',
      numberChangeValue(previous.displayOrder),
      numberChangeValue(block.displayOrder)
    );
    compareBlockField(
      changes,
      block,
      'isVisible',
      booleanChangeValue(previous.isVisible),
      booleanChangeValue(block.isVisible)
    );
  }
  const shownChanges = changes.slice(0, 8);
  return {
    baseVersion,
    changes: shownChanges,
    remainingCount: changes.length - shownChanges.length,
  };
}

function cmsPageRevisionSnapshotsEqual(
  a: CmsPageRevisionSnapshot,
  b: CmsPageRevisionSnapshot
): boolean {
  const comparison = compareCmsPageRevisionSnapshots(a, b);
  return comparison.changes.length === 0 && comparison.remainingCount === 0;
}

function cmsPageRevisionSnapshotsHaveSameContent(
  a: unknown,
  b: unknown
): boolean {
  const aSnapshot = cmsPageRevisionSnapshotFromUnknown(a);
  const bSnapshot = cmsPageRevisionSnapshotFromUnknown(b);
  return Boolean(
    aSnapshot &&
    bSnapshot &&
    cmsPageRevisionSnapshotsEqual(aSnapshot, bSnapshot)
  );
}

function cmsPageRevisionSnapshot(
  row: CmsPageHistoryRow
): Prisma.InputJsonObject {
  return {
    page: {
      id: row.id,
      slug: row.slug,
      path: row.path,
      title: row.title,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      isPublished: row.isPublished,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    blocks: row.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      title: block.title,
      subtitle: block.subtitle,
      body: block.body,
      ctaLabel: block.ctaLabel,
      ctaUrl: block.ctaUrl,
      imageSrc: block.imageSrc,
      imageAlt: block.imageAlt,
      displayOrder: block.displayOrder,
      isVisible: block.isVisible,
      createdAt: block.createdAt.toISOString(),
      updatedAt: block.updatedAt.toISOString(),
    })),
  };
}

function cmsPageRevisionSnapshotJson(
  snapshot: CmsPageRevisionSnapshot
): Prisma.InputJsonObject {
  return {
    page: {
      id: snapshot.page.id,
      slug: snapshot.page.slug,
      path: snapshot.page.path,
      title: snapshot.page.title,
      metaTitle: snapshot.page.metaTitle,
      metaDescription: snapshot.page.metaDescription,
      isPublished: snapshot.page.isPublished,
    },
    blocks: snapshot.blocks.map((block) => ({
      id: block.id,
      kind: block.kind,
      title: block.title,
      subtitle: block.subtitle,
      body: block.body,
      ctaLabel: block.ctaLabel,
      ctaUrl: block.ctaUrl,
      imageSrc: block.imageSrc,
      imageAlt: block.imageAlt,
      displayOrder: block.displayOrder,
      isVisible: block.isVisible,
    })),
  };
}

export async function loadCmsPageRevisionSnapshot(
  pageId: string
): Promise<Prisma.InputJsonObject | null> {
  const page = await prisma.cmsPage.findUnique({
    where: { id: pageId },
    select: CMS_PAGE_HISTORY_SELECT,
  });
  return page ? cmsPageRevisionSnapshot(page) : null;
}

export async function recordCmsPageRevisionFromSnapshot(props: {
  pageId: string;
  action: CmsPageRevisionAction;
  snapshot: Prisma.InputJsonObject;
  createdByUserId?: string;
}): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      const latestRevision = await tx.cmsPageRevision.findFirst({
        orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
        select: {
          snapshot: true,
          version: true,
        },
        where: { pageId: props.pageId },
      });
      const latestSnapshot = cmsPageRevisionSnapshotFromUnknown(
        latestRevision?.snapshot
      );
      const nextSnapshot = cmsPageRevisionSnapshotFromUnknown(props.snapshot);
      if (
        props.action === 'update' &&
        latestSnapshot &&
        nextSnapshot &&
        cmsPageRevisionSnapshotsEqual(latestSnapshot, nextSnapshot)
      ) {
        return;
      }
      await tx.cmsPageRevision.create({
        data: {
          action: props.action,
          createdByUserId: props.createdByUserId ?? null,
          pageId: props.pageId,
          snapshot: props.snapshot,
          version: (latestRevision?.version ?? 0) + 1,
        },
      });
    },
    { isolationLevel: 'Serializable' }
  );
}

export async function recordCmsPageRevision(props: {
  pageId: string;
  action: CmsPageRevisionAction;
  createdByUserId?: string;
}): Promise<void> {
  const snapshot = await loadCmsPageRevisionSnapshot(props.pageId);
  if (!snapshot) {
    return;
  }
  await recordCmsPageRevisionFromSnapshot({
    pageId: props.pageId,
    action: props.action,
    snapshot,
    createdByUserId: props.createdByUserId,
  });
}

export async function recordCmsPageRevisionIfChanged(props: {
  pageId: string;
  action: CmsPageRevisionAction;
  previousSnapshot: Prisma.InputJsonObject | null;
  createdByUserId?: string;
}): Promise<void> {
  const snapshot = await loadCmsPageRevisionSnapshot(props.pageId);
  if (!snapshot) {
    return;
  }
  if (
    props.previousSnapshot &&
    cmsPageRevisionSnapshotsHaveSameContent(props.previousSnapshot, snapshot)
  ) {
    return;
  }
  await recordCmsPageRevisionFromSnapshot({
    action: props.action,
    createdByUserId: props.createdByUserId,
    pageId: props.pageId,
    snapshot,
  });
}

export async function listAdminCmsPageRevisions(
  pageId: string
): Promise<AdminCmsPageRevision[]> {
  const revisions = await prisma.cmsPageRevision.findMany({
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      version: true,
      action: true,
      snapshot: true,
      createdAt: true,
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    take: 20,
    where: { pageId },
  });
  return revisions.map((revision) => ({
    action: revision.action,
    createdAt: revision.createdAt.toISOString(),
    editorEmail: revision.createdBy?.email,
    editorName: revision.createdBy?.name,
    id: revision.id,
    preview: cmsPageRevisionPreview(revision.snapshot),
    version: revision.version,
  }));
}

export async function getAdminCmsPageRevisionCompare(props: {
  pageId: string;
  revisionId: string;
}): Promise<AdminCmsPageRevisionCompare | null> {
  const [currentSnapshotValue, revision] = await Promise.all([
    loadCmsPageRevisionSnapshot(props.pageId),
    prisma.cmsPageRevision.findFirst({
      select: {
        id: true,
        version: true,
        action: true,
        snapshot: true,
        createdAt: true,
        createdBy: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      where: { id: props.revisionId, pageId: props.pageId },
    }),
  ]);
  if (!revision) {
    return null;
  }
  const previousRevision = await prisma.cmsPageRevision.findFirst({
    orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
    select: {
      snapshot: true,
      version: true,
    },
    where: {
      pageId: props.pageId,
      version: { lt: revision.version },
    },
  });
  const baseSnapshot = previousRevision
    ? cmsPageRevisionSnapshotFromUnknown(previousRevision.snapshot)
    : cmsPageRevisionSnapshotFromUnknown(currentSnapshotValue);
  return {
    action: revision.action,
    baseVersion: previousRevision?.version,
    comparison: compareCmsPageRevisionSnapshots(
      baseSnapshot,
      cmsPageRevisionSnapshotFromUnknown(revision.snapshot),
      previousRevision?.version
    ),
    createdAt: revision.createdAt.toISOString(),
    editorEmail: revision.createdBy?.email,
    editorName: revision.createdBy?.name,
    id: revision.id,
    preview: cmsPageRevisionPreview(revision.snapshot),
    version: revision.version,
  };
}

export async function restoreCmsPageRevision(props: {
  pageId: string;
  revisionId: string;
  createdByUserId?: string;
}): Promise<CmsPageRevisionRestoreResult> {
  const [currentPage, revision] = await Promise.all([
    prisma.cmsPage.findUnique({
      select: { id: true },
      where: { id: props.pageId },
    }),
    prisma.cmsPageRevision.findFirst({
      select: { snapshot: true },
      where: { id: props.revisionId, pageId: props.pageId },
    }),
  ]);
  if (!currentPage || !revision) {
    return { ok: false, code: 'not_found' };
  }

  const snapshot = cmsPageRevisionSnapshotFromUnknown(revision.snapshot);
  if (!snapshot || snapshot.page.id !== props.pageId) {
    return { ok: false, code: 'invalid_snapshot' };
  }
  const currentSnapshot = cmsPageRevisionSnapshotFromUnknown(
    await loadCmsPageRevisionSnapshot(props.pageId)
  );
  if (
    currentSnapshot &&
    cmsPageRevisionSnapshotsEqual(currentSnapshot, snapshot)
  ) {
    return { ok: true };
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.cmsPage.update({
        data: {
          isPublished: snapshot.page.isPublished,
          metaDescription: snapshot.page.metaDescription,
          metaTitle: snapshot.page.metaTitle,
          path: snapshot.page.path,
          slug: snapshot.page.slug,
          title: snapshot.page.title,
        },
        where: { id: props.pageId },
      });
      await tx.cmsPageBlock.deleteMany({ where: { pageId: props.pageId } });
      if (snapshot.blocks.length > 0) {
        await tx.cmsPageBlock.createMany({
          data: snapshot.blocks.map((block) => ({
            body: block.body,
            ctaLabel: block.ctaLabel,
            ctaUrl: block.ctaUrl,
            displayOrder: block.displayOrder,
            id: block.id,
            imageAlt: block.imageAlt,
            imageSrc: block.imageSrc,
            isVisible: block.isVisible,
            kind: block.kind,
            pageId: props.pageId,
            subtitle: block.subtitle,
            title: block.title,
          })),
        });
      }
      const latest = await tx.cmsPageRevision.aggregate({
        where: { pageId: props.pageId },
        _max: { version: true },
      });
      await tx.cmsPageRevision.create({
        data: {
          action: 'update',
          createdByUserId: props.createdByUserId ?? null,
          pageId: props.pageId,
          snapshot: cmsPageRevisionSnapshotJson(snapshot),
          version: (latest._max.version ?? 0) + 1,
        },
      });
    },
    { isolationLevel: 'Serializable' }
  );

  return { ok: true };
}
