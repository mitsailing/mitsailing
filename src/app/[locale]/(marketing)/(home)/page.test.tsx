import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(),
  loadPublishedCmsPageByPath: vi.fn(),
  MitSailingHomePageView: vi.fn(() => <div data-testid="home-view" />),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/home/MitSailingHomePageView', () => ({
  MitSailingHomePageView: mocks.MitSailingHomePageView,
}));

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadPublishedCmsPageByPath: mocks.loadPublishedCmsPageByPath,
}));

describe('Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockImplementation(async () => {
      await Promise.resolve();
      return (key: string) => `MitSailingHome.${key}`;
    });
  });

  it('builds homepage metadata from the published CMS page', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue({
      metaDescription: 'CMS home description.',
      metaTitle: 'CMS home title',
    });
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({
      description: 'CMS home description.',
      openGraph: {
        description: 'CMS home description.',
        title: 'CMS home title',
        type: 'website',
      },
      title: 'CMS home title',
      twitter: {
        card: 'summary_large_image',
        description: 'CMS home description.',
        title: 'CMS home title',
      },
    });
    expect(mocks.loadPublishedCmsPageByPath).toHaveBeenCalledWith('/');
  });

  it('falls back to translated home metadata when the CMS homepage is missing', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue(null);
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({
      description: 'MitSailingHome.meta_description',
      openGraph: {
        description: 'MitSailingHome.meta_description',
        title: 'MitSailingHome.meta_title',
        type: 'website',
      },
      title: 'MitSailingHome.meta_title',
      twitter: {
        card: 'summary_large_image',
        description: 'MitSailingHome.meta_description',
        title: 'MitSailingHome.meta_title',
      },
    });
  });

  it('falls back to translated home metadata when CMS meta fields are blank', async () => {
    mocks.loadPublishedCmsPageByPath.mockResolvedValue({
      metaDescription: '   ',
      metaTitle: '',
    });
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({
      description: 'MitSailingHome.meta_description',
      openGraph: {
        description: 'MitSailingHome.meta_description',
        title: 'MitSailingHome.meta_title',
        type: 'website',
      },
      title: 'MitSailingHome.meta_title',
      twitter: {
        card: 'summary_large_image',
        description: 'MitSailingHome.meta_description',
        title: 'MitSailingHome.meta_title',
      },
    });
  });
});
