/**
 * Site footer navigation and legal row — structure + routes only. Copy: `en.json` → `MitSailingSite`.
 */

export type FooterLinkKey =
  | 'footer_link_all_classes'
  | 'footer_link_learn_sail'
  | 'footer_link_intermediate'
  | 'footer_link_learn_race'
  | 'footer_link_boardsailing'
  | 'footer_link_our_fleet'
  | 'footer_link_calendar'
  | 'footer_link_sailing_ratings'
  | 'footer_link_river_webcam'
  | 'footer_link_conditions'
  | 'footer_link_membership'
  | 'footer_link_sailing_team'
  | 'footer_link_pavilion_rental'
  | 'footer_link_about_us'
  | 'footer_link_contact'
  | 'footer_link_event_admin';

type FooterNavLink =
  | { readonly labelKey: FooterLinkKey; readonly href: string }
  | { readonly labelKey: FooterLinkKey; readonly to: string };

type FooterColKey = 'footer_col_learn' | 'footer_col_sail' | 'footer_col_about';

type FooterNavColumn = {
  readonly titleKey: FooterColKey;
  readonly links: readonly FooterNavLink[];
};

export const footerNavColumns: readonly FooterNavColumn[] = [
  {
    titleKey: 'footer_col_learn',
    links: [
      { labelKey: 'footer_link_all_classes', href: '/classes' },
      { labelKey: 'footer_link_learn_sail', href: '#' },
      { labelKey: 'footer_link_intermediate', href: '#' },
      { labelKey: 'footer_link_learn_race', href: '#' },
      { labelKey: 'footer_link_boardsailing', href: '#' },
    ],
  },
  {
    titleKey: 'footer_col_sail',
    links: [
      { labelKey: 'footer_link_our_fleet', href: '/fleet' },
      { labelKey: 'footer_link_calendar', href: '/events' },
      { labelKey: 'footer_link_sailing_ratings', href: '#' },
      { labelKey: 'footer_link_river_webcam', href: '#' },
      { labelKey: 'footer_link_conditions', href: '#' },
    ],
  },
  {
    titleKey: 'footer_col_about',
    links: [
      { labelKey: 'footer_link_membership', href: '#' },
      { labelKey: 'footer_link_sailing_team', href: '#' },
      { labelKey: 'footer_link_pavilion_rental', href: '#' },
      { labelKey: 'footer_link_about_us', href: '#' },
      { labelKey: 'footer_link_contact', to: '/contact' },
      { labelKey: 'footer_link_event_admin', to: '/admin/events' },
    ],
  },
] as const;

export type FooterLegalKey =
  | 'footer_legal_privacy'
  | 'footer_legal_terms'
  | 'footer_legal_accessibility'
  | 'footer_legal_help';

type FooterLegalLink = {
  readonly labelKey: FooterLegalKey;
  readonly href: string;
};

export const footerLegalLinks: readonly FooterLegalLink[] = [
  { labelKey: 'footer_legal_privacy', href: '#' },
  { labelKey: 'footer_legal_terms', href: '#' },
  { labelKey: 'footer_legal_accessibility', href: '#' },
  { labelKey: 'footer_legal_help', href: '#' },
] as const;
