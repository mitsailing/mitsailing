import { render, screen } from '@testing-library/react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicCmsPage } from '@/libs/mit-sailing/cmsQueries';
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

function mockHomeData(cmsHomePage: PublicCmsPage | null) {
  homeDataMocks.getHomeUpcomingDayGroups.mockResolvedValue([]);
  homeDataMocks.getSession.mockResolvedValue(null);
  homeDataMocks.loadHomeClassesBySlugs.mockResolvedValue([]);
  homeDataMocks.loadHomeFeaturedFleetBoats.mockResolvedValue([]);
  homeDataMocks.loadHomeIntroductionClasses.mockResolvedValue([]);
  homeDataMocks.loadSailingClassNamesByIds.mockResolvedValue(new Map());
  homeDataMocks.loadPublishedCmsPageByPath.mockResolvedValue(cmsHomePage);
}

describe('MitSailingHomePageView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders cms body html as rich text on home sections', async () => {
    mockHomeData({
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
        {
          body: JSON.stringify({
            plans: [
              {
                features: ['Full access'],
                linkLabel: 'Join students',
                linkUrl: '/signup/',
                price: '$10',
                title: 'One plan',
              },
            ],
          }),
          ctaLabel: 'Block join',
          ctaUrl: '/block-signup/',
          id: 'pricing-block',
          kind: 'pricing',
          title: 'CMS pricing',
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
    const pageText = view.container.textContent ?? '';
    expect(pageText.indexOf('CMS rental')).toBeLessThan(
      pageText.indexOf('CMS pricing')
    );
    expect(screen.getByRole('link', { name: 'Join students' })).toHaveAttribute(
      'href',
      '/signup/'
    );
    expect(
      screen.queryByRole('link', { name: 'Block join' })
    ).not.toBeInTheDocument();
    expect(view.container).not.toHaveTextContent('<strong>Fast</strong>');
  });

  it('omits default ctas when cms home blocks remove cta fields', async () => {
    mockHomeData({
      blocks: [
        {
          body: '<p>CMS hero body.</p>',
          id: 'hero-block',
          imageAlt: 'Sailboats',
          imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
          kind: 'hero',
          subtitle: 'On the Charles',
          title: 'CMS home hero',
        },
        {
          body: '<p>Reserve the pavilion.</p>',
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
    render(page);

    expect(
      screen.queryByRole('link', { name: 'Explore classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inquire about availability' })
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole('link', { name: 'Create account' }).length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('Membership Options')).not.toBeInTheDocument();
  });

  it('renders home overview content from a composite cms block', async () => {
    mockHomeData({
      blocks: [
        {
          body: JSON.stringify({
            hoursNote: 'CMS note for the table.',
            schedule: [{ day: 'Friday', hours: '4:00 PM – Sunset' }],
            stepsTitle: 'CMS water steps',
            steps: [
              {
                title: 'Bring your card',
                description: 'Check in at the desk.',
              },
            ],
            eventsTitle: 'CMS events',
            eventCount: 2,
            eventsEmptyText: 'No CMS events.',
            eventsCtaLabel: 'All CMS events',
            eventsCtaUrl: '/events/',
          }),
          id: 'home-overview-block',
          kind: 'home_overview',
          subtitle: 'CMS season',
          title: 'CMS hours',
        },
      ],
      id: 'home-page',
      metaDescription: 'Home',
      metaTitle: 'Home',
      path: '/',
      slug: 'home',
      title: 'Home',
    });
    homeDataMocks.getHomeUpcomingDayGroups.mockResolvedValue([
      {
        dateKey: '2026-05-14',
        headingLabel: 'Thu, May 14',
        isToday: false,
        rows: [
          {
            categoryId: 'cat-racing',
            eventName: 'First CMS event',
            eventSlug: 'first-cms-event',
            line: '7:00 PM – 8:00 PM',
            rowKey: 'event-date-1',
          },
          {
            categoryId: 'cat-class',
            eventName: 'Second CMS event',
            eventSlug: 'second-cms-event',
            line: '9:00 PM – 10:00 PM',
            rowKey: 'event-date-2',
          },
        ],
      },
      {
        dateKey: '2026-05-15',
        headingLabel: 'Fri, May 15',
        isToday: false,
        rows: [
          {
            categoryId: 'cat-cruise',
            eventName: 'Third CMS event',
            eventSlug: 'third-cms-event',
            line: '6:00 PM – 7:00 PM',
            rowKey: 'event-date-3',
          },
        ],
      },
    ]);

    const page = await MitSailingHomePageView({ locale: 'en' });
    render(page);

    expect(screen.getByText('CMS hours')).toBeInTheDocument();
    expect(screen.getByText('CMS season')).toBeInTheDocument();
    expect(screen.getByText('Friday')).toBeInTheDocument();
    expect(screen.getByText('4:00 PM – Sunset')).toBeInTheDocument();
    expect(screen.getByText('CMS note for the table.')).toBeInTheDocument();
    expect(screen.getByText('CMS water steps')).toBeInTheDocument();
    expect(screen.getByText('Bring your card')).toBeInTheDocument();
    expect(screen.getByText('CMS events')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'First CMS event' })
    ).toHaveAttribute('href', '/events/first-cms-event/');
    expect(
      screen.getByRole('link', { name: 'Second CMS event' })
    ).toHaveAttribute('href', '/events/second-cms-event/');
    expect(
      screen.queryByRole('link', { name: 'Third CMS event' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'All CMS events' })
    ).toHaveAttribute('href', '/events/');
  });

  it('omits block-managed fallback content when cms home page is missing', async () => {
    mockHomeData(null);

    const page = await MitSailingHomePageView({ locale: 'en' });
    render(page);

    expect(
      screen.queryByRole('link', { name: 'Explore classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inquire about availability' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Membership Options')).not.toBeInTheDocument();
    expect(screen.queryByText('Pavilion Hours')).not.toBeInTheDocument();
  });

  it('omits invalid home overview blocks instead of rendering fallback content', async () => {
    mockHomeData({
      blocks: [
        {
          body: JSON.stringify({
            schedule: [],
          }),
          id: 'home-overview-block',
          kind: 'home_overview',
          subtitle: 'Invalid season',
          title: 'Invalid CMS hours',
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
    render(page);

    expect(screen.queryByText('Invalid CMS hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Pavilion Hours')).not.toBeInTheDocument();
  });
});
