/**
 * Header menu from Menu Layout 11.5 CSV, linking only destinations that exist.
 * Parents with no remaining children are omitted (Racing, Varsity).
 */
export type HeaderMenuSeedItem = {
  id: string;
  label: string;
  url?: string;
  parent?: string;
};

export const HEADER_MENU_SEED_ITEMS: readonly HeaderMenuSeedItem[] = [
  { id: 'header-pavilion', label: 'Pavilion' },
  {
    id: 'header-pavilion-hours',
    label: 'Hours',
    url: '/hours',
    parent: 'header-pavilion',
  },
  {
    id: 'header-pavilion-contact',
    label: 'Contact & Directions',
    url: '/contact',
    parent: 'header-pavilion',
  },
  {
    id: 'header-pavilion-sailing-cards',
    label: 'Sailing Cards',
    url: '/pricing',
    parent: 'header-pavilion',
  },
  {
    id: 'header-pavilion-history',
    label: 'History',
    url: '/about#history',
    parent: 'header-pavilion',
  },
  {
    id: 'header-pavilion-donate',
    label: 'Donate',
    url: '/donate',
    parent: 'header-pavilion',
  },
  {
    id: 'header-pavilion-reserve',
    label: 'Reserve the Pavilion',
    url: '/reserve',
    parent: 'header-pavilion',
  },
  {
    id: 'header-learn',
    label: 'Learn to Sail',
    url: '/classes',
  },
  { id: 'header-membership', label: 'Membership' },
  {
    id: 'header-membership-sailing-card',
    label: 'Sailing Card',
    url: '/pricing',
    parent: 'header-membership',
  },
  {
    id: 'header-membership-ratings',
    label: 'Ratings',
    url: '/ratings',
    parent: 'header-membership',
  },
  {
    id: 'header-membership-account',
    label: 'Account',
    url: '/profile',
    parent: 'header-membership',
  },
  { id: 'header-sailing', label: 'Sailing' },
  {
    id: 'header-sailing-fleet',
    label: 'Our Fleet',
    url: '/fleet',
    parent: 'header-sailing',
  },
  { id: 'header-resources', label: 'Resources' },
  {
    id: 'header-resources-contact',
    label: 'Contact',
    url: '/contact',
    parent: 'header-resources',
  },
  {
    id: 'header-calendar',
    label: 'Calendar',
    url: '/events',
  },
  { id: 'header-community', label: 'Community' },
  {
    id: 'header-community-mitna',
    label: 'MITNA',
    url: '/mitna',
    parent: 'header-community',
  },
  {
    id: 'header-community-volunteer',
    label: 'Volunteer',
    url: '/about#volunteer',
    parent: 'header-community',
  },
  {
    id: 'header-community-staff',
    label: 'Staff',
    url: '/about#staff',
    parent: 'header-community',
  },
  {
    id: 'header-community-hatch',
    label: 'Hatch Brown Service Award',
    url: '/mitna/hatch-award',
    parent: 'header-community',
  },
];

/** CSV labels omitted because no existing page is certain. */
export const HEADER_MENU_OMITTED_LABELS = [
  'Welcome',
  'Overview',
  'Queue',
  'Intro for XP Sailor',
  'Midweek Series',
  'All-In-One Class',
  'Intermediate',
  'What next?',
  'Racing Card',
  'Swim Requirement',
  'Bluewater',
  'Moonlight',
  'Board Sailing',
  'Foiling',
  'High Performance',
  'Learn to Race',
  'Advanced',
  'Team Racing',
  'Racing Results',
  'Guide to MIT Sailing',
  'Booklet',
  'Virtual Tour',
  'Videos',
  'FAQ',
  'Wiki',
  'Gallery',
  'Coaches',
  'Roster',
  'Schedule/ Results',
  'Racing',
  'Varsity',
] as const;
