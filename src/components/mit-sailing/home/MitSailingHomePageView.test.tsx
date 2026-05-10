import { render, screen } from '@testing-library/react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { describe, expect, it, vi } from 'vitest';
import enMessages from '@/locales/en.json';
import { MitSailingHomePageView } from './MitSailingHomePageView';

const homeDataMocks = vi.hoisted(() => ({
  getHomeUpcomingDayGroups: vi.fn(),
  getSession: vi.fn(),
  loadHomeClassesBySlugs: vi.fn(),
  loadHomeFeaturedFleetBoats: vi.fn(),
  loadHomeIntroductionClasses: vi.fn(),
  loadPublishedCmsPageByPath: vi.fn(),
  loadSailingClassNamesByIds: vi.fn(),
}));

const messageCatalogs = new Map(
  Object.entries(enMessages).map(([namespace, catalog]) => [
    namespace,
    new Map(
      Object.entries(catalog).map(([key, value]) => [key, String(value)])
    ),
  ])
);

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(({ namespace }: { namespace: string }) => {
    const catalog = messageCatalogs.get(namespace);
    return (key: string, values?: Record<string, string>) => {
      const message = catalog?.get(key) ?? key;
      return message.replaceAll(/\{(\w+)\}/g, (_match, name: string) => {
        const value = values?.[name];
        return value ?? '';
      });
    };
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: homeDataMocks.getSession,
}));

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadPublishedCmsPageByPath: homeDataMocks.loadPublishedCmsPageByPath,
}));

vi.mock('@/libs/mit-sailing/homeCatalogFromPrisma', () => ({
  loadHomeClassesBySlugs: homeDataMocks.loadHomeClassesBySlugs,
  loadHomeFeaturedFleetBoats: homeDataMocks.loadHomeFeaturedFleetBoats,
  loadHomeIntroductionClasses: homeDataMocks.loadHomeIntroductionClasses,
  loadSailingClassNamesByIds: homeDataMocks.loadSailingClassNamesByIds,
}));

vi.mock('@/libs/mit-sailing/homeUpcomingFromPrisma', () => ({
  getHomeUpcomingDayGroups: homeDataMocks.getHomeUpcomingDayGroups,
}));

describe('MitSailingHomePageView', () => {
  it('renders cms body html as rich text on home sections', async () => {
    homeDataMocks.getHomeUpcomingDayGroups.mockResolvedValue([]);
    homeDataMocks.getSession.mockResolvedValue(null);
    homeDataMocks.loadHomeClassesBySlugs.mockResolvedValue([]);
    homeDataMocks.loadHomeFeaturedFleetBoats.mockResolvedValue([]);
    homeDataMocks.loadHomeIntroductionClasses.mockResolvedValue([]);
    homeDataMocks.loadSailingClassNamesByIds.mockResolvedValue(new Map());
    homeDataMocks.loadPublishedCmsPageByPath.mockResolvedValue({
      blocks: [
        {
          body: '<p><strong>Fast</strong> sailing <a href="/classes/">classes</a></p>',
          ctaLabel: 'Start sailing',
          ctaUrl: '/classes/',
          id: 'hero-block',
          imageAlt: 'Sailboats',
          imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
          kind: 'hero',
          subtitle: 'On the Charles',
          title: 'CMS home hero',
        },
        {
          body: '<p>Reserve the <em>pavilion</em>.</p>',
          ctaLabel: 'Contact us',
          ctaUrl: '/contact/',
          id: 'rental-block',
          kind: 'callout',
          title: 'CMS rental',
        },
      ],
      id: 'home-page',
      metaDescription: 'Home',
      metaTitle: 'Home',
      path: '/',
      slug: 'home',
      title: 'Home',
    });

    const page = await MitSailingHomePageView({ locale: 'en' });
    const view = render(page);

    expect(setRequestLocale).toHaveBeenCalledWith('en');
    expect(getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'MitSailingHome',
    });
    expect(screen.getByText('Fast').tagName).toBe('STRONG');
    expect(screen.getByText('pavilion').tagName).toBe('EM');
    expect(view.container).not.toHaveTextContent('<strong>Fast</strong>');
  });
});
