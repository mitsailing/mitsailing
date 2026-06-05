import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicCmsPage } from '@/libs/mit-sailing/cmsQueries';
import CmsCatchAllPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  loadPublishedCmsPageByPath: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/components/mit-sailing/admin/PublicAdminEditLink', () => ({
  PublicAdminEditLink: (props: { href: string }) => (
    <a data-testid="admin-edit-link" href={props.href}>
      Edit
    </a>
  ),
}));

vi.mock('@/components/mit-sailing/cms/CmsPageBlocks', () => ({
  CmsPageBlocks: (props: { page: PublicCmsPage }) => (
    <main data-testid="cms-page" data-page-id={props.page.id}>
      {props.page.blocks.map((block) => (
        <section key={block.id}>{block.title}</section>
      ))}
    </main>
  ),
}));

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadPublishedCmsPageByPath: mocks.loadPublishedCmsPageByPath,
}));

function pageProps(pathSegments: string[] = ['learn', 'sailing']) {
  return {
    params: Promise.resolve({ cmsPath: pathSegments, locale: 'en' }),
  };
}

function publishedPage(props: Partial<PublicCmsPage> = {}): PublicCmsPage {
  return {
    blocks: [
      {
        body: '<p>Learn at the pavilion.</p>',
        id: 'block-1',
        kind: 'text_section',
        title: 'Learn sailing',
      },
    ],
    id: 'cms-page-1',
    metaDescription: 'Public sailing page.',
    metaTitle: 'Learn Sailing',
    path: '/learn/sailing',
    slug: 'sailing',
    title: 'Learn Sailing',
    ...props,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CmsCatchAllPage', () => {
  it('builds metadata from the published CMS page path', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(publishedPage());

    await expect(generateMetadata(pageProps())).resolves.toEqual({
      description: 'Public sailing page.',
      openGraph: {
        description: 'Public sailing page.',
        title: 'Learn Sailing',
        type: 'website',
      },
      title: 'Learn Sailing',
      twitter: {
        card: 'summary_large_image',
        description: 'Public sailing page.',
        title: 'Learn Sailing',
      },
    });
    expect(mocks.loadPublishedCmsPageByPath).toHaveBeenCalledWith(
      '/learn/sailing'
    );
  });

  it('returns empty metadata for unpublished CMS paths', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(null);

    await expect(generateMetadata(pageProps(['missing']))).resolves.toEqual({});
  });

  it('omits metadata descriptions when the CMS page has no description', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(
      publishedPage({ metaDescription: '' })
    );

    await expect(generateMetadata(pageProps())).resolves.toEqual(
      expect.objectContaining({
        description: undefined,
        openGraph: expect.objectContaining({ description: undefined }),
        twitter: expect.objectContaining({ description: undefined }),
      })
    );
  });

  it('renders the published CMS page and admin edit link', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(publishedPage());

    render(await CmsCatchAllPage(pageProps()));

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(screen.getByTestId('cms-page')).toHaveAttribute(
      'data-page-id',
      'cms-page-1'
    );
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/admin/cms_pages/cms-page-1/edit'
    );
    expect(screen.getByText('Learn sailing')).toBeVisible();
  });

  it('returns not found for missing CMS paths', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(null);

    await expect(CmsCatchAllPage(pageProps(['missing']))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
