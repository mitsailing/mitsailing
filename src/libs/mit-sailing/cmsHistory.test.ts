import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userAuditFindFirst: vi.fn(),
  userAuditFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    userAudit: {
      findFirst: mocks.userAuditFindFirst,
      findMany: mocks.userAuditFindMany,
    },
  },
}));

const { getAdminCmsPageRevisionCompare, listAdminCmsPageRevisions } =
  await import('@/libs/mit-sailing/cmsHistory');

beforeEach(() => {
  mocks.userAuditFindFirst.mockReset();
  mocks.userAuditFindMany.mockReset();
});

function cmsPageSnapshot(props?: { body?: string; metaDescription?: string }) {
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
        kind: 'text_section',
        subtitle: null,
        title: 'Overview',
      },
    ],
    page: {
      id: 'page-1',
      isPublished: true,
      metaDescription: props?.metaDescription ?? 'Sailing overview',
      metaTitle: 'MIT Sailing',
      path: '/',
      slug: 'home',
      title: 'MIT Sailing',
    },
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
              kind: 'text_section',
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
