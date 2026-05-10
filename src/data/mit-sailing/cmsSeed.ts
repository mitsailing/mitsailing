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
    imageSrc?: string;
    imageAlt?: string;
    displayOrder: number;
    isVisible: boolean;
  }[];
};

export type CmsSeedMenu = {
  id: string;
  location: 'header' | 'mobile_utility' | 'footer' | 'legal' | 'social';
  title: string;
  items: readonly CmsSeedMenuItem[];
};

export type CmsSeedMenuItem = {
  id: string;
  parentId?: string;
  linkedPageId?: string;
  label: string;
  url?: string;
  isExternal: boolean;
  isVisible: boolean;
  displayOrder: number;
  systemKey?: string;
};

export const CMS_PAGE_SEED_ROWS: readonly CmsSeedPage[] = [
  {
    id: 'cms-page-home',
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
                  'Free for MIT students. Alumni and public need an MIT Rec membership.',
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
        title: 'Membership Options',
        subtitle:
          'MIT Sailing is open to the entire MIT community and the general public.',
        body: JSON.stringify(
          {
            footnote:
              'Full membership details and MIT Fitness info available from the pavilion.',
            plans: [
              {
                title: 'MIT Students',
                description: 'Enrolled MIT students',
                price: 'Free',
                badge: 'Most Common',
                highlighted: true,
                linkLabel: 'Create account',
                linkUrl: '/signup',
                features: [
                  'Full access to all boats',
                  'All classes and clinics',
                  'Independent sailing rights',
                  'Sailing Team eligibility',
                ],
              },
              {
                title: 'Faculty and Staff',
                description: 'Requires MIT Rec membership',
                price: 'Free',
                frequency: 'with MIT Rec',
                linkLabel: 'Create account',
                linkUrl: '/signup',
                features: [
                  'Full access to all boats',
                  'All classes and clinics',
                  'Independent sailing after rating',
                ],
              },
              {
                title: 'Alumni',
                description: 'MIT alumni — via MIT Fitness',
                price: '$64',
                frequency: '/ month',
                linkLabel: 'Create account',
                linkUrl: '/signup',
                features: [
                  'Full access to all boats',
                  'All classes and clinics',
                  'Independent sailing after rating',
                  'MIT Fitness facility access',
                ],
              },
              {
                title: 'General Public',
                description: 'Non-MIT community',
                price: '$90',
                frequency: '/ month',
                linkLabel: 'Create account',
                linkUrl: '/signup',
                features: [
                  'Full access to all boats',
                  'All classes and clinics',
                  'Independent sailing after rating',
                  'MIT Fitness facility access',
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
        ctaLabel: 'Contact us',
        ctaUrl: '/contact',
        displayOrder: 30,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-about',
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
    slug: 'privacy',
    path: '/privacy',
    title: 'Privacy',
    metaTitle: 'Privacy',
    metaDescription:
      'Sample privacy information for MIT Sailing website visitors and program participants.',
    blocks: [
      {
        id: 'cms-block-privacy-hero',
        kind: 'hero',
        title: 'Privacy',
        body: 'Sample content: This page describes how MIT Sailing may collect, use, and manage information for website visitors, class participants, volunteers, and event guests.',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-privacy-information',
        kind: 'text_section',
        title: 'Information we collect',
        subtitle: 'Sample content',
        body: 'We may collect information that you provide when you register for programs, contact the Pavilion, make a donation inquiry, or sign up for updates. This may include your name, email address, MIT affiliation, program interests, and messages sent through site forms.\n\nWe may also collect basic technical information, such as browser type, device information, referring pages, and pages visited, to help keep the website reliable and useful.',
        displayOrder: 10,
        isVisible: true,
      },
      {
        id: 'cms-block-privacy-use',
        kind: 'text_section',
        title: 'How we use information',
        subtitle: 'Sample content',
        body: 'We use information to respond to requests, coordinate classes and events, maintain safety and membership records, improve website content, and support MIT Sailing operations.\n\nWe do not use sample website content as legal guidance. Production privacy language should be reviewed by the appropriate MIT offices before publication.',
        displayOrder: 20,
        isVisible: true,
      },
      {
        id: 'cms-block-privacy-requests',
        kind: 'text_section',
        title: 'Questions and update requests',
        subtitle: 'Sample content',
        body: 'If you have questions about information associated with MIT Sailing programs, contact the Pavilion staff. We will route requests to the appropriate team when records are managed by another MIT office or service provider.',
        displayOrder: 30,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-terms',
    slug: 'terms',
    path: '/terms',
    title: 'Terms',
    metaTitle: 'Terms',
    metaDescription:
      'Sample terms for using MIT Sailing website content, programs, and facilities.',
    blocks: [
      {
        id: 'cms-block-terms-hero',
        kind: 'hero',
        title: 'Terms',
        body: 'Sample content: These terms outline expected use of MIT Sailing website information, program materials, and public communications.',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-terms-use',
        kind: 'text_section',
        title: 'Acceptable use',
        subtitle: 'Sample content',
        body: 'Use this website for lawful, respectful, and appropriate purposes related to MIT Sailing programs, facilities, events, and community information.\n\nDo not attempt to disrupt the site, misuse forms, submit misleading information, or interfere with another person using MIT Sailing services.',
        displayOrder: 10,
        isVisible: true,
      },
      {
        id: 'cms-block-terms-participation',
        kind: 'text_section',
        title: 'Program and facility participation',
        subtitle: 'Sample content',
        body: 'Participation in sailing classes, fleet use, racing, volunteering, and Pavilion events may require eligibility confirmation, safety briefings, waivers, training, or staff approval.\n\nPosted website information does not replace on-site instructions, class requirements, MIT policies, or directions from Pavilion staff.',
        displayOrder: 20,
        isVisible: true,
      },
      {
        id: 'cms-block-terms-accuracy',
        kind: 'text_section',
        title: 'Content accuracy',
        subtitle: 'Sample content',
        body: 'We work to keep schedules, class descriptions, fleet details, and public information current, but details may change due to weather, staffing, maintenance, or operational needs.\n\nProduction terms should be reviewed by the appropriate MIT offices before publication.',
        displayOrder: 30,
        isVisible: true,
      },
    ],
  },
  {
    id: 'cms-page-accessibility',
    slug: 'accessibility',
    path: '/accessibility',
    title: 'Accessibility',
    metaTitle: 'Accessibility',
    metaDescription:
      'Sample accessibility information for the MIT Sailing website and Pavilion communications.',
    blocks: [
      {
        id: 'cms-block-accessibility-hero',
        kind: 'hero',
        title: 'Accessibility',
        body: 'Sample content: MIT Sailing aims to make website content, program information, and Pavilion communications usable by as many people as possible.',
        displayOrder: 0,
        isVisible: true,
      },
      {
        id: 'cms-block-accessibility-commitment',
        kind: 'text_section',
        title: 'Our commitment',
        subtitle: 'Sample content',
        body: 'We strive to maintain clear navigation, readable content, keyboard-accessible controls, meaningful page structure, and useful alternative text for important images.\n\nAccessibility is an ongoing practice, and we welcome feedback when something on the site is difficult to use.',
        displayOrder: 10,
        isVisible: true,
      },
      {
        id: 'cms-block-accessibility-support',
        kind: 'text_section',
        title: 'Access needs for programs',
        subtitle: 'Sample content',
        body: 'If you plan to attend a class, event, meeting, or Pavilion activity and have access needs, contact Pavilion staff as early as possible. We will work with you and MIT resources to identify reasonable options based on the activity, facility, and safety requirements.',
        displayOrder: 20,
        isVisible: true,
      },
      {
        id: 'cms-block-accessibility-feedback',
        kind: 'text_section',
        title: 'Website feedback',
        subtitle: 'Sample content',
        body: 'To report an accessibility issue with the MIT Sailing website, include the page URL, a short description of the problem, and the browser or assistive technology you were using if that information is available.',
        displayOrder: 30,
        isVisible: true,
      },
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
        id: 'cms-menu-header-classes',
        label: 'Classes',
        url: '/classes',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
        systemKey: 'classes',
      },
      {
        id: 'cms-menu-header-fleet',
        label: 'Fleet',
        url: '/fleet',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
        systemKey: 'fleet',
      },
      {
        id: 'cms-menu-header-bluewater',
        label: 'Bluewater',
        url: '#',
        isExternal: false,
        isVisible: false,
        displayOrder: 20,
      },
      {
        id: 'cms-menu-header-racing',
        label: 'Racing',
        url: '#',
        isExternal: false,
        isVisible: false,
        displayOrder: 30,
      },
      {
        id: 'cms-menu-header-calendar',
        label: 'Calendar',
        url: '/events',
        isExternal: false,
        isVisible: true,
        displayOrder: 40,
      },
      {
        id: 'cms-menu-header-about',
        linkedPageId: 'cms-page-about',
        label: 'About',
        isExternal: false,
        isVisible: true,
        displayOrder: 50,
      },
      {
        id: 'cms-menu-header-resources',
        label: 'Resources',
        url: '#',
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
        id: 'cms-menu-mobile-reserve',
        label: 'Reserve Pavilion',
        linkedPageId: 'cms-page-contact',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-mobile-directions',
        label: 'Directions',
        linkedPageId: 'cms-page-contact',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
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
        id: 'cms-menu-footer-learn',
        label: 'Learn',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-footer-classes',
        parentId: 'cms-menu-footer-learn',
        label: 'All Classes',
        url: '/classes',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-footer-learn-sail',
        parentId: 'cms-menu-footer-learn',
        label: 'Learn to Sail',
        url: '#',
        isExternal: false,
        isVisible: false,
        displayOrder: 10,
      },
      {
        id: 'cms-menu-footer-sail',
        label: 'Sail',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
        id: 'cms-menu-footer-fleet',
        parentId: 'cms-menu-footer-sail',
        label: 'Our Fleet',
        url: '/fleet',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-footer-calendar',
        parentId: 'cms-menu-footer-sail',
        label: 'Calendar',
        url: '/events',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
        id: 'cms-menu-footer-about',
        label: 'About',
        isExternal: false,
        isVisible: true,
        displayOrder: 20,
      },
      {
        id: 'cms-menu-footer-membership',
        parentId: 'cms-menu-footer-about',
        label: 'Membership',
        url: '#',
        isExternal: false,
        isVisible: false,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-footer-about-us',
        parentId: 'cms-menu-footer-about',
        linkedPageId: 'cms-page-about',
        label: 'About Us',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
        id: 'cms-menu-footer-contact',
        parentId: 'cms-menu-footer-about',
        linkedPageId: 'cms-page-contact',
        label: 'Contact',
        isExternal: false,
        isVisible: true,
        displayOrder: 20,
      },
      {
        id: 'cms-menu-footer-event-admin',
        parentId: 'cms-menu-footer-about',
        label: 'Event admin',
        url: '/admin/events',
        isExternal: false,
        isVisible: true,
        displayOrder: 30,
      },
    ],
  },
  {
    id: 'cms-menu-legal',
    location: 'legal',
    title: 'Legal navigation',
    items: [
      {
        id: 'cms-menu-legal-privacy',
        linkedPageId: 'cms-page-privacy',
        label: 'Privacy',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
        id: 'cms-menu-legal-terms',
        linkedPageId: 'cms-page-terms',
        label: 'Terms',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
        id: 'cms-menu-legal-accessibility',
        linkedPageId: 'cms-page-accessibility',
        label: 'Accessibility',
        isExternal: false,
        isVisible: true,
        displayOrder: 20,
      },
      {
        id: 'cms-menu-legal-help',
        label: 'Help',
        url: '#',
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
        id: 'cms-menu-social-recreational',
        label: 'Recreational',
        isExternal: false,
        isVisible: true,
        displayOrder: 0,
      },
      {
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
        id: 'cms-menu-social-varsity',
        label: 'Varsity',
        isExternal: false,
        isVisible: true,
        displayOrder: 10,
      },
      {
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
