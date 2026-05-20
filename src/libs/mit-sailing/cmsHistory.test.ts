import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  cmsPageBlockCount: vi.fn(),
  cmsPageBlockCreateMany: vi.fn(),
  cmsPageBlockDeleteMany: vi.fn(),
  cmsPageFindUnique: vi.fn(),
  cmsPageUpdate: vi.fn(),
  prismaTransaction: vi.fn(),
  recordPublicSlugHistory: vi.fn(),
  userAuditAggregate: vi.fn(),
  userAuditCreate: vi.fn(),
  userAuditFindFirst: vi.fn(),
  userAuditFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    cmsPage: {
      findUnique: mocks.cmsPageFindUnique,
      update: mocks.cmsPageUpdate,
    },
    cmsPageBlock: {
      count: mocks.cmsPageBlockCount,
      createMany: mocks.cmsPageBlockCreateMany,
      deleteMany: mocks.cmsPageBlockDeleteMany,
    },
    userAudit: {
      aggregate: mocks.userAuditAggregate,
      create: mocks.userAuditCreate,
      findFirst: mocks.userAuditFindFirst,
      findMany: mocks.userAuditFindMany,
    },
    $transaction: mocks.prismaTransaction,
  },
}));

vi.mock('@/libs/mit-sailing/publicSlugHistory', () => ({
  recordPublicSlugHistory: mocks.recordPublicSlugHistory,
}));

const {
  cmsPageRevisionSnapshotsEqual,
  getAdminCmsPageRevisionCompare,
  listAdminCmsPageRevisions,
  restoreCmsPageRevision,
} = await import('@/libs/mit-sailing/cmsHistory');

beforeEach(() => {
  mocks.cmsPageBlockCount.mockReset();
  mocks.cmsPageBlockCreateMany.mockReset();
  mocks.cmsPageBlockDeleteMany.mockReset();
  mocks.cmsPageFindUnique.mockReset();
  mocks.cmsPageUpdate.mockReset();
  mocks.prismaTransaction.mockReset();
  mocks.recordPublicSlugHistory.mockReset();
  mocks.userAuditAggregate.mockReset();
  mocks.userAuditCreate.mockReset();
  mocks.userAuditFindFirst.mockReset();
  mocks.userAuditFindMany.mockReset();
  mocks.prismaTransaction.mockImplementation(
    async (transactionBody: (tx: unknown) => Promise<unknown>) => {
      const result = await transactionBody({
        cmsPage: {
          update: mocks.cmsPageUpdate,
        },
        cmsPageBlock: {
          count: mocks.cmsPageBlockCount,
          createMany: mocks.cmsPageBlockCreateMany,
          deleteMany: mocks.cmsPageBlockDeleteMany,
        },
        userAudit: {
          aggregate: mocks.userAuditAggregate,
          create: mocks.userAuditCreate,
        },
      });
      return result;
    }
  );
  mocks.cmsPageBlockCount.mockResolvedValue(0);
  mocks.userAuditAggregate.mockResolvedValue({ _max: { version: 2 } });
});

function cmsPageSnapshot(props?: {
  body?: string;
  metaDescription?: string;
  path?: string;
}) {
  return {
    blocks: [
      {
        body: props?.body ?? '<p>Learn to sail.</p>',
        ctaLabel: null,
        ctaUrl: null,
        displayOrder: 1,
        id: 'block-1',
        imageAlt: null,
        imageSrc: null,
        isVisible: true,
        kind: 'text_section' as const,
        showCta: false,
        showImage: false,
        subtitle: null,
        title: 'Overview',
      },
    ],
    page: {
      id: 'page-1',
      isPublished: true,
      metaDescription: props?.metaDescription ?? 'Sailing overview',
      metaTitle: 'MIT Sailing',
      path: props?.path ?? '/',
      slug: 'home',
      title: 'MIT Sailing',
    },
  };
}

function cmsPageRowFromSnapshot(snapshot: ReturnType<typeof cmsPageSnapshot>) {
  return {
    ...snapshot.page,
    createdAt: new Date('2026-05-10T10:00:00.000Z'),
    updatedAt: new Date('2026-05-10T12:00:00.000Z'),
    blocks: snapshot.blocks.map((block) => ({
      ...block,
      createdAt: new Date('2026-05-10T10:00:00.000Z'),
      updatedAt: new Date('2026-05-10T12:00:00.000Z'),
    })),
  };
}

describe('listAdminCmsPageRevisions', () => {
  it('maps audit rows to page revision summaries', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        action: 'update',
        auditedChanges: cmsPageSnapshot({
          body: '<p>Learn, race, and volunteer.</p>',
          metaDescription: 'Updated sailing overview',
        }),
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-2',
        user: { email: 'admin@example.com', name: 'Admin Sailor' },
        version: 2,
      },
      {
        action: 'create',
        auditedChanges: cmsPageSnapshot(),
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
        id: 'audit-1',
        user: null,
        version: 1,
      },
    ]);

    await expect(listAdminCmsPageRevisions('page-1')).resolves.toEqual([
      {
        action: 'update',
        createdAt: '2026-05-10T12:00:00.000Z',
        editorEmail: 'admin@example.com',
        editorName: 'Admin Sailor',
        id: 'audit-2',
        preview: {
          blockCount: 1,
          excerpt: 'Learn, race, and volunteer.',
          pagePath: '/',
          pageTitle: 'MIT Sailing',
        },
        summary: {
          changes: [
            { field: 'metaDescription', kind: 'page_field' },
            { blockTitle: 'Overview', field: 'body', kind: 'block_field' },
          ],
          kind: 'changes',
          remainingCount: 0,
        },
        version: 2,
      },
      {
        action: 'create',
        createdAt: '2026-05-10T11:00:00.000Z',
        editorEmail: undefined,
        editorName: undefined,
        id: 'audit-1',
        preview: {
          blockCount: 1,
          excerpt: 'Learn to sail.',
          pagePath: '/',
          pageTitle: 'MIT Sailing',
        },
        summary: { kind: 'created' },
        version: 1,
      },
    ]);
    expect(mocks.userAuditFindMany).toHaveBeenCalledWith({
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: {
        action: true,
        auditedChanges: true,
        createdAt: true,
        id: true,
        user: { select: { email: true, name: true } },
        version: true,
      },
      take: 21,
      where: { auditableId: 'page-1', auditableType: 'cms_pages' },
    });
  });

  it('preview excerpt falls back to subtitle or title when body has no plain text', async () => {
    mocks.userAuditFindMany.mockResolvedValue([
      {
        action: 'update',
        auditedChanges: {
          blocks: [
            {
              body: '<p></p>',
              ctaLabel: null,
              ctaUrl: null,
              displayOrder: 1,
              id: 'block-1',
              imageAlt: null,
              imageSrc: null,
              isVisible: true,
              kind: 'text_section' as const,
              showCta: false,
              showImage: false,
              subtitle: 'Section subtitle',
              title: 'Overview',
            },
          ],
          page: {
            id: 'page-1',
            isPublished: true,
            metaDescription: 'Sailing overview',
            metaTitle: 'MIT Sailing',
            path: '/',
            slug: 'home',
            title: 'MIT Sailing',
          },
        },
        createdAt: new Date('2026-05-10T12:00:00.000Z'),
        id: 'audit-1',
        user: null,
        version: 2,
      },
    ]);

    await expect(listAdminCmsPageRevisions('page-1')).resolves.toEqual([
      expect.objectContaining({
        preview: expect.objectContaining({
          excerpt: 'Section subtitle',
        }),
      }),
    ]);
  });
});

describe('cmsPageRevisionSnapshotsEqual', () => {
  it('returns false when body markup differs but plain text matches', () => {
    const plain = cmsPageSnapshot({ body: '<p>Learn to sail.</p>' });
    const emphasized = cmsPageSnapshot({
      body: '<p><em>Learn to sail.</em></p>',
    });
    expect(cmsPageRevisionSnapshotsEqual(plain, emphasized)).toBe(false);
  });

  it('returns true when snapshots match exactly', () => {
    const snapshot = cmsPageSnapshot({
      body: '<p>Same <strong>markup</strong>.</p>',
    });
    expect(
      cmsPageRevisionSnapshotsEqual(snapshot, structuredClone(snapshot))
    ).toBe(true);
  });
});

describe('getAdminCmsPageRevisionCompare', () => {
  it('uses empty diff when the revision has no predecessor', async () => {
    const snapshot = cmsPageSnapshot();
    mocks.userAuditFindFirst
      .mockResolvedValueOnce({
        action: 'create',
        auditedChanges: snapshot,
        createdAt: new Date('2026-05-10T11:00:00.000Z'),
        id: 'audit-1',
        user: null,
        version: 1,
      })
      .mockResolvedValueOnce(null);

    const result = await getAdminCmsPageRevisionCompare({
      pageId: 'page-1',
      revisionId: 'audit-1',
    });

    expect(result?.comparison.changes).toEqual([]);
    expect(result?.comparison.remainingCount).toBe(0);
    expect(result?.baseVersion).toBeUndefined();
    expect(mocks.userAuditFindFirst).toHaveBeenNthCalledWith(1, {
      select: {
        action: true,
        auditedChanges: true,
        createdAt: true,
        id: true,
        user: { select: { email: true, name: true } },
        version: true,
      },
      where: {
        auditableId: 'page-1',
        auditableType: 'cms_pages',
        id: 'audit-1',
      },
    });
    expect(mocks.userAuditFindFirst).toHaveBeenNthCalledWith(2, {
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      select: { auditedChanges: true, version: true },
      where: {
        auditableId: 'page-1',
        auditableType: 'cms_pages',
        version: { lt: 1 },
      },
    });
  });
});

describe('restoreCmsPageRevision', () => {
  it('records cms path history when restoring to an old path', async () => {
    const restoredSnapshot = cmsPageSnapshot({ path: '/about' });
    mocks.cmsPageFindUnique
      .mockResolvedValueOnce({
        id: 'page-1',
        path: '/about-us',
      })
      .mockResolvedValueOnce(
        cmsPageRowFromSnapshot(cmsPageSnapshot({ path: '/about-us' }))
      );
    mocks.userAuditFindFirst.mockResolvedValue({
      auditedChanges: restoredSnapshot,
    });
    mocks.cmsPageUpdate.mockResolvedValue({ id: 'page-1' });

    await expect(
      restoreCmsPageRevision({
        pageId: 'page-1',
        revisionId: 'audit-1',
      })
    ).resolves.toEqual({ ok: true });

    expect(mocks.recordPublicSlugHistory).toHaveBeenCalledWith({
      currentSlug: '/about',
      db: expect.any(Object),
      previousSlug: '/about-us',
      scope: 'cms',
      sluggableId: 'page-1',
      sluggableType: 'CmsPage',
    });
  });
});
