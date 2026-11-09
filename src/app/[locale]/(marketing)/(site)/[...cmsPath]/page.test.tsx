import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublishedPayloadPage } from '@/libs/payload/loadPublishedPayloadPage';
import CmsCatchAllPage, { generateMetadata } from './page';

const mocks = vi.hoisted(() => ({
  cmsDraftPreviewEnabled: vi.fn(),
  loadPublishedPayloadPage: vi.fn(),
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
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('@/libs/payload/appOrigin', () => ({
  appOrigin: () => 'http://localhost:3000',
}));

vi.mock('@/libs/payload/cmsDraftPreview', () => ({
  cmsDraftPreviewEnabled: mocks.cmsDraftPreviewEnabled,
}));

vi.mock('@/components/mit-sailing/cms/RefreshPayloadPreview', () => ({
  RefreshPayloadPreview: () => null,
}));

vi.mock('@/components/mit-sailing/admin/PublicAdminEditLink', () => ({
  PublicAdminEditLink: (props: { href: string }) => (
    <a data-testid="admin-edit-link" href={props.href}>
      Edit
    </a>
  ),
}));

vi.mock('@/components/mit-sailing/cms/PayloadLexicalRichText', () => ({
  PayloadLexicalRichText: () => <div data-testid="payload-body">Body</div>,
}));

vi.mock('@/libs/payload/loadPublishedPayloadPage', () => ({
  loadPublishedPayloadPage: mocks.loadPublishedPayloadPage,
}));

function pageProps(pathSegments: string[] = ['learn', 'sailing']) {
  return {
    params: Promise.resolve({ cmsPath: pathSegments, locale: 'en' }),
  };
}

function publishedPage(
  props: Partial<PublishedPayloadPage> = {}
): PublishedPayloadPage {
  return {
    body: {
      root: {
        children: [],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    },
    id: '42',
    layout: null,
    slug: 'learn/sailing',
    title: 'Learn Sailing',
    ...props,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.cmsDraftPreviewEnabled.mockResolvedValue(false);
});

describe('CmsCatchAllPage', () => {
  it('builds metadata from the published Payload page', async () => {
    mocks.loadPublishedPayloadPage.mockResolvedValue(publishedPage());

    await expect(generateMetadata(pageProps())).resolves.toEqual({
      openGraph: {
        title: 'Learn Sailing',
        type: 'website',
      },
      title: 'Learn Sailing',
      twitter: {
        card: 'summary_large_image',
        title: 'Learn Sailing',
      },
    });
    expect(mocks.loadPublishedPayloadPage).toHaveBeenCalledWith([
      'learn',
      'sailing',
    ]);
  });

  it('returns empty metadata for unpublished CMS paths', async () => {
    mocks.loadPublishedPayloadPage.mockResolvedValue(null);

    await expect(generateMetadata(pageProps(['missing']))).resolves.toEqual({});
  });

  it('renders the published Payload page and admin edit link', async () => {
    mocks.loadPublishedPayloadPage.mockResolvedValue(publishedPage());

    render(await CmsCatchAllPage(pageProps()));

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(
      screen.getByRole('heading', { name: 'Learn Sailing' })
    ).toBeVisible();
    expect(screen.getByTestId('payload-body')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/cms/collections/pages/42'
    );
  });

  it('renders layout blocks instead of the page body', async () => {
    mocks.loadPublishedPayloadPage.mockResolvedValue(
      publishedPage({
        layout: [
          {
            blockType: 'media',
            id: 'wide',
            media: {
              alt: 'Charles River',
              height: 600,
              url: '/cms-media/charles.jpg',
              width: 800,
            },
          },
        ],
      })
    );

    render(await CmsCatchAllPage(pageProps()));

    expect(screen.getByTestId('page-layout')).toBeVisible();
    expect(
      screen.getByRole('img', { name: 'Charles River' }).getAttribute('src')
    ).toContain('charles.jpg');
    expect(screen.queryByTestId('payload-body')).not.toBeInTheDocument();
  });

  it('returns not found for missing CMS paths', async () => {
    mocks.loadPublishedPayloadPage.mockResolvedValue(null);

    await expect(CmsCatchAllPage(pageProps(['missing']))).rejects.toThrow(
      'NEXT_NOT_FOUND'
    );
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });
});
