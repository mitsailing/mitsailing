import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userAuditFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    userAudit: {
      findMany: mocks.userAuditFindMany,
    },
  },
}));

const { listAdminCmsPageRevisions } =
  await import('@/libs/mit-sailing/cmsHistory');

beforeEach(() => {
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
  });
});
