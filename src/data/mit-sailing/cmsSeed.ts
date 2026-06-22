export type CmsSeedPage = {
  id: string;
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  isPublished?: boolean;
  blocks: readonly {
    id: string;
    kind:
      | 'hero'
      | 'text_section'
      | 'callout'
      | 'pricing'
      | 'home_overview'
      | 'home_classes';
    title: string;
    subtitle?: string;
    body?: string;
    ctaLabel?: string;
    ctaUrl?: string;
    showCta?: boolean;
    imageSrc?: string;
    imageAlt?: string;
    showImage?: boolean;
    displayOrder: number;
    isVisible: boolean;
  }[];
};

type CmsSeedBlock = CmsSeedPage['blocks'][number];

function cmsHeroBlock(props: {
  readonly body: string;
  readonly id: string;
  readonly title: string;
}): CmsSeedBlock {
  return {
    body: props.body,
    displayOrder: 0,
    id: props.id,
    isVisible: true,
    kind: 'hero',
    title: props.title,
  };
}

function cmsTextSectionBlock(props: {
  readonly body: string;
  readonly displayOrder: number;
  readonly id: string;
  readonly subtitle?: string;
  readonly title: string;
}): CmsSeedBlock {
  return {
    body: props.body,
    displayOrder: props.displayOrder,
    id: props.id,
    isVisible: true,
    kind: 'text_section',
    subtitle: props.subtitle,
    title: props.title,
  };
}

export type CmsSeedMenu = {
  id: string;
  location: 'header' | 'mobile_utility' | 'footer' | 'legal' | 'social';
  title: string;
  items: readonly CmsSeedMenuItem[];
};

type CmsSeedMenuItemShared = {
  id: string;
  parentId?: string;
  label: string;
  isVisible: boolean;
  displayOrder: number;
  systemKey?: string;
};

/** Parent-only row: no `url` and no `linkedPageId` in the database. */
export type CmsSeedMenuItemGroup = CmsSeedMenuItemShared & {
  kind: 'group';
};

/** Links to a CMS page by id; `url` is derived at render time from the page path. */
export type CmsSeedMenuItemPageLink = CmsSeedMenuItemShared & {
  kind: 'page_link';
  linkedPageId: string;
};

/** Static path or external URL; `isExternal` matches `CmsMenuItem.is_external`. */
export type CmsSeedMenuItemUrlLink = CmsSeedMenuItemShared & {
  kind: 'url_link';
  /** Omit for placeholder items (stored as null; no public href until set). */
  url?: string;
  isExternal: boolean;
};

export type CmsSeedMenuItem =
  | CmsSeedMenuItemGroup
  | CmsSeedMenuItemPageLink
  | CmsSeedMenuItemUrlLink;

export function orderedCmsSeedMenuItems(menu: CmsSeedMenu): CmsSeedMenuItem[] {
  const itemsById = new Map<string, CmsSeedMenuItem>();
  for (const item of menu.items) {
    if (itemsById.has(item.id)) {
      throw new Error(
        `CMS menu seed "${menu.id}" contains duplicate item "${item.id}"`
      );
    }
    itemsById.set(item.id, item);
  }

  const ordered: CmsSeedMenuItem[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function visit(item: CmsSeedMenuItem): void {
    if (visited.has(item.id)) {
      return;
    }
    if (visiting.has(item.id)) {
      throw new Error(
        `CMS menu seed "${menu.id}" contains a parent cycle at item "${item.id}"`
      );
    }

    visiting.add(item.id);
    if (item.parentId) {
      const parent = itemsById.get(item.parentId);
      if (!parent) {
        throw new Error(
          `CMS menu seed "${menu.id}" item "${item.id}" references missing parent "${item.parentId}"`
        );
      }
      visit(parent);
    }
    visiting.delete(item.id);
    visited.add(item.id);
    ordered.push(item);
  }

  for (const item of menu.items) {
    visit(item);
  }

  return ordered;
}

export const CMS_PAGE_SEED_ROWS: readonly CmsSeedPage[] = [
  {
    id: 'cms-page-home',
    isPublished: true,
    slug: 'home',
    path: '/',
    title: 'MIT Sailing',
    metaTitle: 'MIT Sailing',
    metaDescription: 'Pavilion and programs on the Charles.',
    blocks: [
      {
        id: 'cms-block-home-hero',
        kind: 'hero',
        title: 'Sail the Charles River',
        subtitle: 'MIT Sailing Pavilion',
        body: "Learn, race, volunteer, and explore the river with one of the nation's most active university sailing communities.",
        ctaLabel: 'View classes',
        ctaUrl: '/classes',
        imageSrc: '/assets/images/home-hero-charles-sailing.jpg',
        imageAlt: 'Sailboats on the Charles River near MIT',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-home-overview',
        kind: 'home_overview',
        title: 'Pavilion Hours',
        subtitle: 'Open 7 days a week · April 1 – November 15',
        body: JSON.stringify(
          {
            hoursNote:
              'Sunset times and daily open hours follow the table. Team practices run on a separate schedule.',
            schedule: [
              { day: 'Monday', hours: '3:00 pm – Sunset' },
              { day: 'Tuesday', hours: 'Noon – Sunset' },
              { day: 'Wednesday', hours: 'Noon – Sunset' },
              { day: 'Thursday', hours: 'Noon – Sunset' },
              { day: 'Friday', hours: 'Noon – Sunset' },
              { day: 'Saturday', hours: 'Noon – Sunset' },
              { day: 'Sunday', hours: 'Noon – Sunset' },
            ],
            stepsTitle: 'How to get on the water',
            steps: [
              {
                title: 'Create your account',
                description:
                  'MIT students and MIT Recreation members get Normal included, including Charles River racing. Others can compare paid racing cards before requesting a card.',
              },
              {
                title: 'Take a beginner class',
                description:
                  'Sign up for Learn to Sail or Intro for Experienced Sailors.',
              },
              {
                title: 'Get your rating and sail',
                description:
                  'Pass your skills test, receive your rating, and book boats anytime.',
              },
            ],
            eventsTitle: 'Upcoming Events',
            eventCount: 4,
            eventsEmptyText: 'No events scheduled in the next 7 days.',
            eventsCtaLabel: 'View all events',
            eventsCtaUrl: '/events',
          },
          null,
          2
        ),
        displayOrder: 5,
        isVisible: true,
      },
      {
        id: 'cms-block-home-membership-pricing',
        kind: 'pricing',
        title: 'Pricing',
        subtitle: 'Choose the card that matches what you want to sail.',
        body: JSON.stringify(
          {
            footnoteLinkLabel: 'See MIT Recreation rates',
            footnoteLinkUrl: '/pricing',
            plans: [
              {
                title: 'Normal',
                description: 'Pavilion, classes, ratings, racing, Mashnee.',
                price: 'Free',
                priceRows: [
                  { label: 'MIT student', value: 'Free' },
                  { label: 'MIT Recreation member', value: 'Free' },
                ],
                linkLabel: 'Sign up',
                linkUrl: '/signup?callbackUrl=%2Fonboarding',
                features: [
                  'Normal access to Pavilion sailing, classes, ratings, racing, and Mashnee.',
                  'MIT students qualify automatically.',
                  'MIT Recreation members qualify with an active membership.',
                ],
              },
              {
                title: 'Spring racing card',
                description:
                  'For regular Pavilion racing from April 1 through July 14.',
                price: '$25',
                priceRows: [
                  { label: 'Non-MIT student', value: '$25' },
                  { label: 'Under 30', value: '$70' },
                  { label: '30+', value: '$100' },
                ],
                linkLabel: 'Sign up',
                linkUrl: '/signup?callbackUrl=%2Fonboarding',
                features: [
                  'Regular Pavilion racing from April 1 through July 14.',
                  'Race-related classes included.',
                  'Valid through July 14.',
                ],
              },
              {
                title: 'Full-year racing card',
                description: 'Regular Pavilion racing for the full card year.',
                price: '$40',
                priceRows: [
                  { label: 'Non-MIT student', value: '$40' },
                  { label: 'Under 30', value: '$125' },
                  { label: '30+', value: '$175' },
                ],
                linkLabel: 'Sign up',
                linkUrl: '/signup?callbackUrl=%2Fonboarding',
                features: [
                  'Regular Pavilion racing for the full card year.',
                  'Race-related classes included.',
                  'Does not include Thursday team racing.',
                ],
              },
              {
                title: 'Thursday team racing',
                description: 'For Thursday team racing on the Charles River.',
                price: '$25',
                priceRows: [
                  { label: 'Non-MIT student', value: '$25' },
                  { label: 'Under 30', value: '$70' },
                  { label: '30+', value: '$100' },
                ],
                linkLabel: 'Sign up',
                linkUrl: '/signup?callbackUrl=%2Fonboarding',
                features: [
                  'Thursday team racing on the Charles River.',
                  'No regular Pavilion racing.',
                ],
              },
            ],
          },
          null,
          2
        ),
        displayOrder: 20,
        isVisible: true,
      },
      {
        id: 'cms-block-home-classes',
        kind: 'home_classes',
        title: 'Learn to Sail',
        subtitle:
          'Every sailor starts with a required beginner class. Once you have your first rating, choose from a range of advanced courses.',
        ctaLabel: 'View all classes',
        ctaUrl: '/classes',
        displayOrder: 10,
        isVisible: true,
      },
      {
        id: 'cms-block-home-rental',
        kind: 'callout',
        title: 'Reserve the Pavilion',
        body: 'The Sailing Pavilion is available for selected MIT community events and waterfront gatherings.',
        ctaLabel: 'Reserve Pavilion',
        ctaUrl: '/reserve',
        displayOrder: 30,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-about',
    isPublished: true,
    slug: 'about',
    path: '/about',
    title: 'About MIT Sailing',
    metaTitle: 'About MIT Sailing',
    metaDescription:
      'Mission, history, staff, and volunteer opportunities at MIT Sailing.',
    blocks: [
      {
        id: 'cms-block-about-intro',
        kind: 'hero',
        title: 'About MIT Sailing',
        body: 'MIT Sailing teaches sailing, seamanship, and racing on the Charles River for students, alumni, affiliates, and the broader community.',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-about-mission',
        kind: 'text_section',
        title: 'Our mission',
        subtitle:
          'How we serve the MIT community and grow lifelong skills on the water.',
        body: 'We make sailing approachable, safe, and rewarding through instruction, fleet access, racing, and volunteer leadership.',
        displayOrder: 10,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-contact',
    isPublished: true,
    slug: 'contact',
    path: '/contact',
    title: 'Contact',
    metaTitle: 'Contact',
    metaDescription:
      'Contact MIT Sailing, find Pavilion addresses, and get directions for Pavilion and Mashnee Bluewater events.',
    blocks: [
      {
        id: 'cms-block-contact-hero',
        kind: 'hero',
        title: 'Contact MIT Sailing',
        body: 'Reach the MIT Sailing Pavilion for program questions, facility information, class support, Bluewater sailing, and waterfront visit planning.',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-contact-general',
        kind: 'text_section',
        title: 'General questions',
        body: 'For general questions about MIT Sailing, classes, fleet access, volunteer opportunities, and Pavilion operations, contact the Pavilion staff.\n\nEmail: sailing@mit.edu\nPhone: 617-253-4884',
        displayOrder: 10,
        isVisible: true,
      },
      {
        id: 'cms-block-contact-visit',
        kind: 'text_section',
        title: 'Visit the Pavilion',
        subtitle: 'Pavilion and Mashnee locations',
        body: 'MIT Sailing is based at the Walter C. Wood Sailing Pavilion on the Charles River. Bluewater/Mashnee events meet at Boston Waterboat Marina near Long Wharf, not at the Pavilion on Memorial Drive.',
        ctaLabel: 'View Mashnee directions',
        ctaUrl: '/contact#mashnee-directions',
        displayOrder: 20,
        isVisible: true,
      },
      {
        id: 'cms-block-contact-events',
        kind: 'text_section',
        title: 'Reserve Pavilion',
        body: 'For Pavilion reservations, facility requests, or partnership questions, contact Pavilion staff and we will route the request appropriately.',
        displayOrder: 30,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-privacy',
    isPublished: true,
    slug: 'privacy',
    path: '/privacy',
    title: 'Privacy',
    metaTitle: 'Privacy',
    metaDescription:
      'Sample privacy information for MIT Sailing website visitors and program participants.',
    blocks: [
      cmsHeroBlock({
        body: 'Sample content: This page describes how MIT Sailing may collect, use, and manage information for website visitors, class participants, volunteers, and event guests.',
        id: 'cms-block-privacy-hero',
        title: 'Privacy',
      }),
      cmsTextSectionBlock({
        body: 'We may collect information that you provide when you register for programs, contact the Pavilion, make a donation inquiry, or sign up for updates. This may include your name, email address, MIT affiliation, program interests, and messages sent through site forms.\n\nWe may also collect basic technical information, such as browser type, device information, referring pages, and pages visited, to help keep the website reliable and useful.',
        displayOrder: 10,
        id: 'cms-block-privacy-information',
        subtitle: 'Sample content',
        title: 'Information we collect',
      }),
      cmsTextSectionBlock({
        body: 'We use information to respond to requests, coordinate classes and events, maintain safety and membership records, improve website content, and support MIT Sailing operations.\n\nWe do not use sample website content as legal guidance. Production privacy language should be reviewed by the appropriate MIT offices before publication.',
        displayOrder: 20,
        id: 'cms-block-privacy-use',
        subtitle: 'Sample content',
        title: 'How we use information',
      }),
      cmsTextSectionBlock({
        body: 'If you have questions about information associated with MIT Sailing programs, contact the Pavilion staff. We will route requests to the appropriate team when records are managed by another MIT office or service provider.',
        displayOrder: 30,
        id: 'cms-block-privacy-requests',
        subtitle: 'Sample content',
        title: 'Questions and update requests',
      }),
    ],
  },
  {
    id: 'cms-page-terms',
    isPublished: true,
    slug: 'terms',
    path: '/terms',
    title: 'Terms',
    metaTitle: 'Terms',
    metaDescription:
      'Sample terms for using MIT Sailing website content, programs, and facilities.',
    blocks: [
      cmsHeroBlock({
        body: 'Sample content: These terms outline expected use of MIT Sailing website information, program materials, and public communications.',
        id: 'cms-block-terms-hero',
        title: 'Terms',
      }),
      cmsTextSectionBlock({
        body: 'Use this website for lawful, respectful, and appropriate purposes related to MIT Sailing programs, facilities, events, and community information.\n\nDo not attempt to disrupt the site, misuse forms, submit misleading information, or interfere with another person using MIT Sailing services.',
        displayOrder: 10,
        id: 'cms-block-terms-use',
        subtitle: 'Sample content',
        title: 'Acceptable use',
      }),
      cmsTextSectionBlock({
        body: 'Participation in sailing classes, fleet use, racing, volunteering, and Pavilion events may require eligibility confirmation, safety briefings, waivers, training, or staff approval.\n\nPosted website information does not replace on-site instructions, class requirements, MIT policies, or directions from Pavilion staff.',
        displayOrder: 20,
        id: 'cms-block-terms-participation',
        subtitle: 'Sample content',
        title: 'Program and facility participation',
      }),
      cmsTextSectionBlock({
        body: 'We work to keep schedules, class descriptions, fleet details, and public information current, but details may change due to weather, staffing, maintenance, or operational needs.\n\nProduction terms should be reviewed by the appropriate MIT offices before publication.',
        displayOrder: 30,
        id: 'cms-block-terms-accuracy',
        subtitle: 'Sample content',
        title: 'Content accuracy',
      }),
    ],
  },
  {
    id: 'cms-page-accessibility',
    isPublished: true,
    slug: 'accessibility',
    path: '/accessibility',
    title: 'Accessibility',
    metaTitle: 'Accessibility',
    metaDescription:
      'Sample accessibility information for the MIT Sailing website and Pavilion communications.',
    blocks: [
      cmsHeroBlock({
        body: 'Sample content: MIT Sailing aims to make website content, program information, and Pavilion communications usable by as many people as possible.',
        id: 'cms-block-accessibility-hero',
        title: 'Accessibility',
      }),
      cmsTextSectionBlock({
        body: 'We strive to maintain clear navigation, readable content, keyboard-accessible controls, meaningful page structure, and useful alternative text for important images.\n\nAccessibility is an ongoing practice, and we welcome feedback when something on the site is difficult to use.',
        displayOrder: 10,
        id: 'cms-block-accessibility-commitment',
        subtitle: 'Sample content',
        title: 'Our commitment',
      }),
      cmsTextSectionBlock({
        body: 'If you plan to attend a class, event, meeting, or Pavilion activity and have access needs, contact Pavilion staff as early as possible. We will work with you and MIT resources to identify reasonable options based on the activity, facility, and safety requirements.',
        displayOrder: 20,
        id: 'cms-block-accessibility-support',
        subtitle: 'Sample content',
        title: 'Access needs for programs',
      }),
      cmsTextSectionBlock({
        body: 'To report an accessibility issue with the MIT Sailing website, include the page URL, a short description of the problem, and the browser or assistive technology you were using if that information is available.',
        displayOrder: 30,
        id: 'cms-block-accessibility-feedback',
        subtitle: 'Sample content',
        title: 'Website feedback',
      }),
    ],
  },
];

export const CMS_MENU_SEED_ROWS: readonly CmsSeedMenu[] = [
  {
    id: 'cms-menu-header',
    location: 'header',
    title: 'Header navigation',
    items: [
      {
        kind: 'url_link',
        id: 'cms-menu-header-classes',
        label: 'Classes',
        url: '/classes',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
        systemKey: 'classes',
      },
      {
        kind: 'url_link',
        id: 'cms-menu-header-fleet',
        label: 'Fleet',
        url: '/fleet',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
        systemKey: 'fleet',
      },
      {
        kind: 'url_link',
        id: 'cms-menu-header-racing',
        label: 'Racing',
        isExternal: false,
        isVisible: false,
        displayOrder: 30,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-header-calendar',
        label: 'Calendar',
        url: '/events',
        isExternal: false,
        isVisible: true,
        displayOrder: 40,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-header-pricing',
        label: 'Pricing',
        url: '/pricing',
        isExternal: false,
        isVisible: true,
        displayOrder: 45,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-header-about',
        linkedPageId: 'cms-page-about',
        label: 'About',
        isVisible: true,
        displayOrder: 50,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-header-resources',
        label: 'Resources',
        isExternal: false,
        isVisible: false,
        displayOrder: 60,
      },
    ],
  },
  {
    id: 'cms-menu-mobile-utility',
    location: 'mobile_utility',
    title: 'Mobile utility navigation',
    items: [
      {
        kind: 'url_link',
        id: 'cms-menu-mobile-reserve',
        label: 'Reserve Pavilion',
        url: '/reserve',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-mobile-directions',
        label: 'Directions',
        linkedPageId: 'cms-page-contact',
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-mobile-donate',
        label: 'Donate',
        url: '/donate',
        isExternal: false,
        isVisible: true,
        displayOrder: 20,
      },
    ],
  },
  {
    id: 'cms-menu-footer',
    location: 'footer',
    title: 'Footer navigation',
    items: [
      {
        kind: 'group',
        id: 'cms-menu-footer-learn',
        label: 'Learn',
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-footer-classes',
        parentId: 'cms-menu-footer-learn',
        label: 'All Classes',
        url: '/classes',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-footer-learn-sail',
        parentId: 'cms-menu-footer-learn',
        label: 'Learn to Sail',
        isExternal: false,
        isVisible: false,
        displayOrder: 10,
      },
      {
        kind: 'group',
        id: 'cms-menu-footer-sail',
        label: 'Sail',
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-footer-fleet',
        parentId: 'cms-menu-footer-sail',
        label: 'Our Fleet',
        url: '/fleet',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-footer-calendar',
        parentId: 'cms-menu-footer-sail',
        label: 'Calendar',
        url: '/events',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'group',
        id: 'cms-menu-footer-about',
        label: 'About',
        isVisible: true,
        displayOrder: 20,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-footer-membership',
        parentId: 'cms-menu-footer-about',
        label: 'Pricing',
        url: '/pricing',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-footer-about-us',
        parentId: 'cms-menu-footer-about',
        linkedPageId: 'cms-page-about',
        label: 'About Us',
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-footer-contact',
        parentId: 'cms-menu-footer-about',
        linkedPageId: 'cms-page-contact',
        label: 'Contact',
        isVisible: true,
        displayOrder: 20,
      },
    ],
  },
  {
    id: 'cms-menu-legal',
    location: 'legal',
    title: 'Legal navigation',
    items: [
      {
        kind: 'page_link',
        id: 'cms-menu-legal-privacy',
        linkedPageId: 'cms-page-privacy',
        label: 'Privacy',
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-legal-terms',
        linkedPageId: 'cms-page-terms',
        label: 'Terms',
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'page_link',
        id: 'cms-menu-legal-accessibility',
        linkedPageId: 'cms-page-accessibility',
        label: 'Accessibility',
        isVisible: true,
        displayOrder: 20,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-legal-help',
        label: 'Help',
        isExternal: false,
        isVisible: false,
        displayOrder: 30,
      },
    ],
  },
  {
    id: 'cms-menu-social',
    location: 'social',
    title: 'Social links',
    items: [
      {
        kind: 'group',
        id: 'cms-menu-social-recreational',
        label: 'Recreational',
        isVisible: true,
        displayOrder: 0,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-social-instagram',
        parentId: 'cms-menu-social-recreational',
        label: 'MIT Recreational Sailing on Instagram',
        url: 'https://www.instagram.com/mitsailingpavilion',
        isExternal: true,
        isVisible: true,
        displayOrder: 0,
        systemKey: 'instagram',
      },
      {
        kind: 'url_link',
        id: 'cms-menu-social-facebook',
        parentId: 'cms-menu-social-recreational',
        label: 'MIT Recreational Sailing on Facebook',
        url: 'https://www.facebook.com/MIT.Sailing.Pavilion',
        isExternal: true,
        isVisible: true,
        displayOrder: 10,
        systemKey: 'facebook',
      },
      {
        kind: 'group',
        id: 'cms-menu-social-varsity',
        label: 'Varsity',
        isVisible: true,
        displayOrder: 10,
      },
      {
        kind: 'url_link',
        id: 'cms-menu-social-varsity-instagram',
        parentId: 'cms-menu-social-varsity',
        label: 'MIT Varsity Sailing on Instagram',
        url: 'https://www.instagram.com/mitsailing/',
        isExternal: true,
        isVisible: true,
        displayOrder: 0,
        systemKey: 'instagram',
      },
    ],
  },
];
