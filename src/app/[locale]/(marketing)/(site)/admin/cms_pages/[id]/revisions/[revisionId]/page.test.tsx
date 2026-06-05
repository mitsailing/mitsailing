import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminCmsPageRevisionCompare } from '@/libs/mit-sailing/cmsHistory';
import AdminCmsPageRevisionComparePage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  getAdminCmsPageRevisionCompare: vi.fn(),
  getTranslations: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  requirePermission: vi.fn(),
  restoreCmsPageRevisionAction: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock(
  '@/components/mit-sailing/admin/catalog/AdminCmsRevisionCompareView',
  () => ({
    AdminCmsRevisionCompareView: (props: {
      compare: AdminCmsPageRevisionCompare;
      editHref: string;
      fieldLabels: Record<string, string>;
      text: {
        compareHeading: string;
        moreChanges: (...args: [number]) => string;
        snapshotVersion: (...args: [number]) => string;
      };
    }) => (
      <main
        data-edit-href={props.editHref}
        data-more-changes={props.text.moreChanges(2)}
        data-path-label={props.fieldLabels.path}
        data-snapshot-version={props.text.snapshotVersion(7)}
        data-testid="revision-compare"
      >
        {props.text.compareHeading}
        {props.compare.id}
      </main>
    ),
  })
);

vi.mock('@/libs/admin/catalog/catalogActions', () => ({
  restoreCmsPageRevisionAction: mocks.restoreCmsPageRevisionAction,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/mit-sailing/cmsHistory', () => ({
  getAdminCmsPageRevisionCompare: mocks.getAdminCmsPageRevisionCompare,
}));

function pageProps() {
  return {
    params: Promise.resolve({
      id: 'page-1',
      locale: 'en',
      revisionId: 'revision-1',
    }),
  };
}

function compareFixture(): AdminCmsPageRevisionCompare {
  return {
    action: 'update',
    baseVersion: 6,
    comparison: {
      baseVersion: 6,
      changes: [
        {
          after: { kind: 'text', value: '/learn-sailing' },
          before: { kind: 'text', value: '/learn' },
          field: 'path',
          kind: 'page_field',
        },
      ],
      remainingCount: 0,
    },
    createdAt: '2026-05-17T12:00:00.000Z',
    editorEmail: 'admin@example.com',
    editorName: 'Admin',
    id: 'revision-1',
    preview: {
      blockCount: 1,
      excerpt: 'Updated learn sailing content',
      pagePath: '/learn-sailing',
      pageTitle: 'Learn Sailing',
    },
    summary: {
      changes: [{ field: 'path', kind: 'page_field' }],
      kind: 'changes',
      remainingCount: 0,
    },
    version: 7,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue((key: string, values?: unknown) =>
    values && typeof values === 'object'
      ? `${key}:${JSON.stringify(values)}`
      : key
  );
  mocks.requirePermission.mockResolvedValue(null);
  mocks.getAdminCmsPageRevisionCompare.mockResolvedValue(compareFixture());
});

describe('AdminCmsPageRevisionComparePage', () => {
  it('builds metadata from the admin route translation namespace', async () => {
    await expect(generateMetadata(pageProps())).resolves.toEqual({
      title: 'meta_title_admin_catalog_revision_compare',
    });
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'MitSailingRoutes',
    });
  });

  it('requires restore permission before loading revision comparison data', async () => {
    const error = new Error('permission denied');
    mocks.requirePermission.mockRejectedValue(error);

    await expect(AdminCmsPageRevisionComparePage(pageProps())).rejects.toThrow(
      'permission denied'
    );
    expect(mocks.getAdminCmsPageRevisionCompare).not.toHaveBeenCalled();
  });

  it('renders the requested CMS revision comparison for admins', async () => {
    render(await AdminCmsPageRevisionComparePage(pageProps()));

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.getAdminCmsPageRevisionCompare).toHaveBeenCalledWith({
      pageId: 'page-1',
      revisionId: 'revision-1',
    });
    expect(screen.getByTestId('revision-compare')).toHaveAttribute(
      'data-edit-href',
      '/admin/cms_pages/page-1/edit'
    );
    expect(screen.getByTestId('revision-compare')).toHaveAttribute(
      'data-path-label',
      'field_cms_path'
    );
    expect(screen.getByTestId('revision-compare')).toHaveAttribute(
      'data-more-changes',
      'cms_revision_more_changes:{"count":2}'
    );
    expect(screen.getByTestId('revision-compare')).toHaveTextContent(
      'cms_revision_compare_headingrevision-1'
    );
  });

  it('returns not found when the CMS revision no longer exists', async () => {
    mocks.getAdminCmsPageRevisionCompare.mockResolvedValue(null);

    await expect(AdminCmsPageRevisionComparePage(pageProps())).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
