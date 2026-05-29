import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  PublicCmsBlock,
  PublicCmsPage,
} from '@/libs/mit-sailing/cmsQueries';
import type { HomeUpcomingDayGroup } from '@/libs/mit-sailing/homeUpcomingFromPrisma';
import enMessages from '@/locales/en.json';
import { MitSailingHomePageView } from './MitSailingHomePageView';

const homeMocks = vi.hoisted(() => ({
  getHomeUpcomingDayGroups: vi.fn(),
  getSession: vi.fn(),
  getTranslations: vi.fn(),
  loadHomeLearnToSailIntroductionClasses: vi.fn(),
  loadHomeLearnToSailNextClassesBySlugs: vi.fn(),
  loadHomeLearnToSailPrerequisiteNamesByIds: vi.fn(),
  loadPublishedCmsPageByPath: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: homeMocks.getTranslations,
  setRequestLocale: homeMocks.setRequestLocale,
}));

vi.mock('next/image', () => ({
  default: (props: {
    alt: string;
    className?: string;
    height?: number;
    src: string;
    width?: number;
  }) => (
    // eslint-disable-next-line @next/next/no-img-element -- Test double for `next/image`.
    <img
      alt={props.alt}
      className={props.className}
      height={props.height}
      src={props.src}
      width={props.width}
    />
  ),
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession: homeMocks.getSession,
}));

vi.mock('@/libs/mit-sailing/cmsQueries', () => ({
  loadPublishedCmsPageByPath: homeMocks.loadPublishedCmsPageByPath,
}));

vi.mock('@/libs/mit-sailing/homeLearnToSailFromPrisma', () => ({
  loadHomeLearnToSailIntroductionClasses:
    homeMocks.loadHomeLearnToSailIntroductionClasses,
  loadHomeLearnToSailNextClassesBySlugs:
    homeMocks.loadHomeLearnToSailNextClassesBySlugs,
  loadHomeLearnToSailPrerequisiteNamesByIds:
    homeMocks.loadHomeLearnToSailPrerequisiteNamesByIds,
}));

vi.mock('@/libs/mit-sailing/homeUpcomingFromPrisma', () => ({
  getHomeUpcomingDayGroups: homeMocks.getHomeUpcomingDayGroups,
}));

const homeMessages = enMessages.MitSailingHome;

function isHomeMessageKey(key: string): key is keyof typeof homeMessages {
  return Object.hasOwn(homeMessages, key);
}

const translate = (key: string, values: Record<string, string> = {}) => {
  if (!isHomeMessageKey(key)) {
    return key;
  }

  const message = homeMessages[key];
  return message.replaceAll(
    /\{(\w+)\}/g,
    (_match, name: string) => values[name] ?? ''
  );
};

const introClasses = [
  {
    description: 'Learn rigging and basic boat handling.',
    id: 'intro-id',
    level: 'Beginner',
    name: 'Intro Sailing',
    prerequisiteIds: [],
    slug: 'intro-sailing',
  },
];

const nextClasses = [
  {
    description: 'Build speed without prerequisites.',
    id: 'advanced-id',
    level: 'Advanced',
    name: 'Advanced Boat Speed',
    prerequisiteIds: [],
    slug: 'advanced-boat-speed',
  },
  {
    description: 'Continue after intro sailing.',
    id: 'racing-id',
    level: 'Intermediate',
    name: 'Intro to Racing',
    prerequisiteIds: ['intro-id'],
    slug: 'intro-to-racing',
  },
  {
    description: 'Unknown prerequisite still has a badge.',
    id: 'strategy-id',
    level: 'Intermediate',
    name: 'Racing Strategy',
    prerequisiteIds: ['missing-id'],
    slug: 'racing-strategy',
  },
];

const upcomingGroups = [
  {
    dateKey: '2026-05-10',
    headingLabel: 'Today',
    isToday: true,
    rows: [
      {
        categoryId: 'cat-class',
        categoryAccentClassName: 'bg-mit-success',
        eventName: 'Intro sail',
        eventSlug: 'intro-sail',
        line: '10:00 AM - noon',
        rowKey: 'today-row',
      },
    ],
  },
  {
    dateKey: '2026-05-11',
    headingLabel: 'Mon, May 11',
    isToday: false,
    rows: [
      {
        categoryId: 'cat-racing',
        categoryAccentClassName: 'bg-mit-red',
        eventName: 'Racing clinic',
        eventSlug: 'racing-clinic',
        line: '6:00 PM - 8:00 PM',
        rowKey: 'tomorrow-row',
      },
    ],
  },
] satisfies HomeUpcomingDayGroup[];

const blocks = [
  {
    body: '<p>Membership includes <strong>boats</strong> and community.</p>',
    ctaLabel: 'See classes',
    ctaUrl: '/classes',
    id: 'hero',
    imageAlt: 'Sailors on the Charles River',
    imageSrc: '/uploads/hero.jpg',
    kind: 'hero',
    subtitle: 'Cambridge, Massachusetts',
    title: 'Learn to sail on the Charles',
  },
  {
    body: JSON.stringify({
      eventCount: 2,
      eventsCtaLabel: 'Full calendar',
      eventsCtaUrl: 'https://calendar.example.edu',
      eventsEmptyText: 'No events posted.',
      eventsTitle: 'Upcoming at MIT Sailing',
      hoursNote: 'Sunset can change launch times.',
      schedule: [
        { day: 'Weekdays', hours: 'Noon - 8 PM' },
        { day: 'Weekends', hours: '9 AM - 6 PM' },
      ],
      steps: [
        {
          description: 'Create an account and review pavilion rules.',
          title: 'Join online',
        },
        {
          description: 'Take the introductory class before solo sailing.',
          title: 'Take a class',
        },
      ],
      stepsTitle: 'Getting started',
    }),
    id: 'overview',
    kind: 'home_overview',
    subtitle: 'What to know before you visit',
    title: 'Daily Sailing',
  },
  {
    ctaLabel: 'Browse classes',
    ctaUrl: '/classes',
    id: 'classes',
    kind: 'home_classes',
    subtitle: 'Progress through ratings',
    title: 'Learn to sail',
  },
  {
    body: JSON.stringify({
      footnote: 'Rates are subject to change.',
      footnoteLinkLabel: 'See MIT Recreation rates',
      footnoteLinkUrl: '/pricing',
      plans: [
        {
          badge: 'Best value',
          description: 'For currently registered students.',
          features: ['Unlimited rentals', 'Club events'],
          frequency: 'per year',
          highlighted: true,
          linkLabel: 'Choose student',
          linkUrl: '/signup',
          price: '$95',
          title: 'Student pass',
        },
      ],
    }),
    id: 'pricing',
    kind: 'pricing',
    subtitle: 'Membership options',
    title: 'Sailing passes',
  },
  {
    body: '<p>Reserve the pavilion or ask about rentals.</p>',
    ctaLabel: 'Book rentals',
    ctaUrl: '/contact',
    id: 'rental',
    imageAlt: 'Dock with dinghies',
    imageSrc: '/uploads/rentals.jpg',
    kind: 'callout',
    title: 'Rentals and pavilion',
  },
] satisfies PublicCmsBlock[];

const homePage = {
  blocks,
  id: 'home',
  metaDescription: 'Home page',
  metaTitle: 'MIT Sailing',
  path: '/',
  slug: 'home',
  title: 'MIT Sailing',
} satisfies PublicCmsPage;

function createOverviewBlock(props: {
  eventCount?: number;
  eventsCtaLabel?: string;
  eventsCtaUrl?: string;
}) {
  return {
    body: JSON.stringify({
      eventCount: props.eventCount ?? 2,
      eventsCtaLabel: props.eventsCtaLabel ?? 'Full calendar',
      eventsCtaUrl: props.eventsCtaUrl ?? 'https://calendar.example.edu',
      eventsEmptyText: 'No events posted.',
      eventsTitle: 'Upcoming at MIT Sailing',
      hoursNote: 'Sunset can change launch times.',
      schedule: [
        { day: 'Weekdays', hours: 'Noon - 8 PM' },
        { day: 'Weekends', hours: '9 AM - 6 PM' },
      ],
      steps: [
        {
          description: 'Create an account and review pavilion rules.',
          title: 'Join online',
        },
        {
          description: 'Take the introductory class before solo sailing.',
          title: 'Take a class',
        },
      ],
      stepsTitle: 'Getting started',
    }),
    id: 'overview',
    kind: 'home_overview',
    subtitle: 'What to know before you visit',
    title: 'Daily Sailing',
  } satisfies PublicCmsBlock;
}

function homePageWithBlocks(nextBlocks: PublicCmsBlock[]) {
  return {
    ...homePage,
    blocks: nextBlocks,
  } satisfies PublicCmsPage;
}

describe('MitSailingHomePageView', () => {
  beforeEach(() => {
    homeMocks.getTranslations.mockResolvedValue(translate);
    homeMocks.getSession.mockResolvedValue(null);
    homeMocks.getHomeUpcomingDayGroups.mockResolvedValue(upcomingGroups);
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(homePage);
    homeMocks.loadHomeLearnToSailIntroductionClasses.mockResolvedValue(
      introClasses
    );
    homeMocks.loadHomeLearnToSailNextClassesBySlugs.mockResolvedValue(
      nextClasses
    );
    homeMocks.loadHomeLearnToSailPrerequisiteNamesByIds.mockResolvedValue(
      new Map([['intro-id', 'Intro Sailing']])
    );
    homeMocks.setRequestLocale.mockReset();
  });

  it('renders fallback shell when the published CMS homepage is missing', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(null);

    const result = render(await MitSailingHomePageView({ locale: 'en' }));

    expect(result.container.querySelector('section')).toBeNull();
    expect(
      homeMocks.loadHomeLearnToSailNextClassesBySlugs
    ).not.toHaveBeenCalled();
  });

  it('renders cms home sections with events and class paths', async () => {
    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(homeMocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(homeMocks.loadPublishedCmsPageByPath).toHaveBeenCalledWith('/');
    expect(
      screen.getByRole('img', { name: 'Sailors on the Charles River' })
    ).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Learn to sail on the Charles' })
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'See classes' })).toHaveAttribute(
      'href',
      '/classes'
    );
    expect(
      screen.getByRole('link', { name: 'Create account' })
    ).toHaveAttribute('href', '/signup');

    expect(
      screen.getByRole('heading', { name: 'Daily Sailing' })
    ).toBeVisible();
    expect(screen.getByText('Weekdays')).toBeVisible();
    expect(screen.getByText('Sunset can change launch times.')).toBeVisible();
    expect(screen.getByText('Join online')).toBeVisible();
    expect(screen.getByText('Upcoming at MIT Sailing')).toBeVisible();
    expect(screen.getByText('Today')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Intro sail' })).toHaveAttribute(
      'href',
      '/events/intro-sail'
    );
    expect(screen.getByRole('link', { name: 'Racing clinic' })).toHaveAttribute(
      'href',
      '/events/racing-clinic'
    );
    expect(screen.getByRole('link', { name: 'Full calendar' })).toHaveAttribute(
      'target',
      '_blank'
    );
    expect(screen.getByRole('link', { name: 'Full calendar' })).toHaveAttribute(
      'rel',
      expect.stringContaining('noopener')
    );
    expect(screen.getByRole('link', { name: 'Full calendar' })).toHaveAttribute(
      'rel',
      expect.stringContaining('noreferrer')
    );

    expect(
      screen.getByRole('heading', { name: 'Learn to sail' })
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: /Intro Sailing/u })
    ).toHaveAttribute('href', '/classes/intro-sailing');
    expect(screen.getByText('Advanced')).toBeVisible();
    expect(screen.getByText('After: Intro Sailing')).toBeVisible();
    expect(screen.getByText('Prerequisites')).toBeVisible();

    expect(
      screen.getByRole('heading', { name: 'Sailing passes' })
    ).toBeVisible();
    expect(screen.getByText('Best value')).toBeVisible();
    expect(screen.getByText('Unlimited rentals')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Choose student' })
    ).toHaveAttribute('href', '/signup');
    expect(
      screen.getByRole('link', { name: 'See MIT Recreation rates' })
    ).toHaveAttribute('href', '/pricing');

    const rentalSection = screen
      .getByRole('heading', { name: 'Rentals and pavilion' })
      .closest('section');
    expect(rentalSection).not.toBeNull();
    if (!rentalSection) {
      throw new Error('Expected rentals section to render');
    }
    expect(
      within(rentalSection).getByRole('link', {
        name: 'Book rentals',
      })
    ).toHaveAttribute('href', '/contact');
  });

  it('limits public event links and omits account creation for signed-in sailors', async () => {
    const [heroBlock] = blocks;
    if (!heroBlock) {
      throw new Error('Expected hero block fixture');
    }

    homeMocks.getSession.mockResolvedValue({
      user: { id: 'sailor-id' },
    });
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        heroBlock,
        createOverviewBlock({ eventCount: 1, eventsCtaUrl: '/events' }),
      ])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(
      screen.queryByRole('link', { name: 'Create account' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Intro sail' })).toHaveAttribute(
      'href',
      '/events/intro-sail'
    );
    expect(
      screen.queryByRole('link', { name: 'Racing clinic' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Full calendar' })).toHaveAttribute(
      'href',
      '/events'
    );
    expect(
      screen.getByRole('link', { name: 'Full calendar' })
    ).not.toHaveAttribute('target');
  });

  it('renders text_section blocks in the ordered cms strip', async () => {
    const callout = blocks.find((block) => block.id === 'rental');
    if (!callout || callout.kind !== 'callout') {
      throw new Error('Expected rental callout block');
    }
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        ...blocks.slice(0, 4),
        {
          body: '<p>Weekend clinics need coaches.</p>',
          id: 'cms-block-home-text',
          kind: 'text_section',
          title: 'Volunteer spotlight',
        },
        callout,
      ])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(
      screen.getByRole('heading', { name: 'Volunteer spotlight' })
    ).toBeVisible();
    expect(screen.getByText('Weekend clinics need coaches.')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Rentals and pavilion' })
    ).toBeVisible();
  });

  it('does not render unsafe cms overview cta links', async () => {
    homeMocks.getHomeUpcomingDayGroups.mockResolvedValue([]);
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        createOverviewBlock({
          eventsCtaLabel: 'Unsafe calendar',
          eventsCtaUrl: ['java', 'script:alert(1)'].join(''),
        }),
      ])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(screen.queryByText('No events posted.')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Unsafe calendar' })
    ).not.toBeInTheDocument();
  });

  it('does not render unsafe cms section cta links', async () => {
    const unsafeUrl = ['java', 'script:alert(1)'].join('');
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks(
        blocks.map((block) =>
          block.kind === 'hero' ||
          block.kind === 'home_classes' ||
          block.kind === 'callout'
            ? { ...block, ctaUrl: unsafeUrl }
            : block
        )
      )
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(
      screen.queryByRole('link', { name: 'See classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Browse classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Book rentals' })
    ).not.toBeInTheDocument();
  });

  it('renders cms rich text and ordered block ctas', async () => {
    const heroBlock = blocks.find((block) => block.id === 'hero');
    const rentalBlock = blocks.find((block) => block.id === 'rental');
    if (!heroBlock || !rentalBlock || rentalBlock.kind !== 'callout') {
      throw new Error('Expected home hero and rental blocks');
    }
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        {
          ...heroBlock,
          body: '<p><strong>Fast</strong> sailing <a href="/classes">classes</a></p>',
          title: 'CMS home hero',
        },
        {
          ...rentalBlock,
          body: '<p>Reserve the <em>pavilion</em>.</p>',
          ctaLabel: 'Contact us',
          ctaUrl: '/contact',
          title: 'CMS rental',
        },
        {
          body: JSON.stringify({
            plans: [
              {
                features: ['Full access'],
                linkLabel: 'Join students',
                linkUrl: '/signup',
                price: '$10',
                title: 'One plan',
              },
            ],
          }),
          ctaLabel: 'Block join',
          ctaUrl: '/block-signup',
          id: 'pricing-block',
          kind: 'pricing',
          title: 'CMS pricing',
        },
      ])
    );

    const view = render(await MitSailingHomePageView({ locale: 'en' }));

    expect(screen.getByText('Fast').tagName).toBe('STRONG');
    expect(screen.getByText('pavilion').tagName).toBe('EM');
    const pageText = view.container.textContent ?? '';
    expect(pageText.indexOf('CMS rental')).toBeLessThan(
      pageText.indexOf('CMS pricing')
    );
    expect(screen.getByRole('link', { name: 'Join students' })).toHaveAttribute(
      'href',
      '/signup'
    );
    expect(
      screen.queryByRole('link', { name: 'Block join' })
    ).not.toBeInTheDocument();
    expect(view.container).not.toHaveTextContent('<strong>Fast</strong>');
  });

  it('omits default ctas when cms home blocks remove cta fields', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
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
      ])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(
      screen.queryByRole('link', { name: 'Explore classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inquire about availability' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Create account' })
    ).toHaveAttribute('href', '/signup');
    expect(screen.queryByText('Membership Options')).not.toBeInTheDocument();
  });

  it('renders home overview content from a composite cms block', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        createOverviewBlock({
          eventCount: 2,
          eventsCtaLabel: 'All CMS events',
          eventsCtaUrl: '/events',
        }),
      ])
    );
    homeMocks.getHomeUpcomingDayGroups.mockResolvedValue([
      {
        dateKey: '2026-05-14',
        headingLabel: 'Thu, May 14',
        isToday: false,
        rows: [
          {
            categoryId: 'cat-racing',
            categoryAccentClassName: 'bg-mit-red',
            eventName: 'First CMS event',
            eventSlug: 'first-cms-event',
            line: '7:00 PM - 8:00 PM',
            rowKey: 'event-date-1',
          },
          {
            categoryId: 'cat-class',
            categoryAccentClassName: 'bg-mit-success',
            eventName: 'Second CMS event',
            eventSlug: 'second-cms-event',
            line: '9:00 PM - 10:00 PM',
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
            categoryAccentClassName: 'bg-mit-cat',
            eventName: 'Third CMS event',
            eventSlug: 'third-cms-event',
            line: '6:00 PM - 7:00 PM',
            rowKey: 'event-date-3',
          },
        ],
      },
    ]);

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(screen.getByText('Daily Sailing')).toBeInTheDocument();
    expect(
      screen.getByText('What to know before you visit')
    ).toBeInTheDocument();
    expect(screen.getByText('Weekdays')).toBeInTheDocument();
    expect(screen.getByText('Noon - 8 PM')).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.getByText('Join online')).toBeInTheDocument();
    expect(screen.getByText('Upcoming at MIT Sailing')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'First CMS event' })
    ).toHaveAttribute('href', '/events/first-cms-event');
    expect(
      screen.getByRole('link', { name: 'Second CMS event' })
    ).toHaveAttribute('href', '/events/second-cms-event');
    expect(
      screen.queryByRole('link', { name: 'Third CMS event' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'All CMS events' })
    ).toHaveAttribute('href', '/events');
  });

  it('renders learn to sail content from a cms block with class data', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        {
          ctaLabel: 'All classes',
          ctaUrl: '/classes',
          id: 'home-classes-block',
          kind: 'home_classes',
          subtitle: 'CMS class path copy.',
          title: 'CMS Learn to Sail',
        },
      ])
    );
    homeMocks.loadHomeLearnToSailIntroductionClasses.mockResolvedValue([
      {
        description: 'Intro class description.',
        id: 'class-intro',
        level: 'Beginner',
        name: 'Learn to Sail',
        prerequisiteIds: [],
        slug: 'learn-to-sail',
      },
    ]);
    homeMocks.loadHomeLearnToSailNextClassesBySlugs.mockResolvedValue([
      {
        description: 'Next class description.',
        id: 'class-next',
        level: 'Intermediate',
        name: 'Boat Speed',
        prerequisiteIds: ['class-intro'],
        slug: 'boat-speed',
      },
    ]);
    homeMocks.loadHomeLearnToSailPrerequisiteNamesByIds.mockResolvedValue(
      new Map([['class-intro', 'Learn to Sail']])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(screen.getByText('CMS Learn to Sail')).toBeInTheDocument();
    expect(screen.getByText('CMS class path copy.')).toBeInTheDocument();
    expect(screen.getByText('Boat Speed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'All classes' })).toHaveAttribute(
      'href',
      '/classes'
    );
  });

  it('omits block-managed fallback content when cms home page is missing', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(null);

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(
      screen.queryByRole('link', { name: 'Explore classes' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Inquire about availability' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Membership Options')).not.toBeInTheDocument();
    expect(screen.queryByText('Pavilion Hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Our Core Fleet')).not.toBeInTheDocument();
    expect(screen.queryByText('Learn to Sail')).not.toBeInTheDocument();
  });

  it('omits invalid home overview blocks instead of rendering fallback content', async () => {
    homeMocks.loadPublishedCmsPageByPath.mockResolvedValue(
      homePageWithBlocks([
        {
          body: JSON.stringify({
            schedule: [],
          }),
          id: 'home-overview-block',
          kind: 'home_overview',
          subtitle: 'Invalid season',
          title: 'Invalid CMS hours',
        },
      ])
    );

    render(await MitSailingHomePageView({ locale: 'en' }));

    expect(screen.queryByText('Invalid CMS hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Pavilion Hours')).not.toBeInTheDocument();
  });
});
