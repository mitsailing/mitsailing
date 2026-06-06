import { hasAnyPermission, Permission } from '@/libs/auth/appPermissions';
import type messages from '@/locales/en.json';

export type AdminNavItem = {
  href: string;
  labelKey: keyof typeof messages.AdminSideNav;
  match: 'exact' | 'prefix';
  permissions: readonly Permission[];
};

export const ADMIN_SITE_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    labelKey: 'nav_admin',
    match: 'exact',
    permissions: [Permission.ADMIN_VIEW],
  },
  {
    href: '/admin/site_text',
    labelKey: 'nav_site_text',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    href: '/admin/users',
    labelKey: 'nav_users',
    match: 'prefix',
    permissions: [Permission.USERS_VIEW],
  },
  {
    href: '/admin/pavilion-reservations',
    labelKey: 'nav_pavilion_reservations',
    match: 'prefix',
    permissions: [Permission.PAVILION_RESERVATIONS_MANAGE],
  },
  {
    href: '/admin/newsletter-subscribers',
    labelKey: 'nav_newsletter_subscribers',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    href: '/admin/newsletter-lists',
    labelKey: 'nav_newsletter_lists',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    href: '/admin/newsletter-broadcasts',
    labelKey: 'nav_newsletter_broadcasts',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    href: '/admin/newsletter-templates',
    labelKey: 'nav_newsletter_templates',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    href: '/admin/email-templates',
    labelKey: 'nav_email_templates',
    match: 'prefix',
    permissions: [Permission.EMAIL_TEMPLATES_MANAGE],
  },
  {
    href: '/admin/donation_funds',
    labelKey: 'nav_donation_funds',
    match: 'prefix',
    permissions: [Permission.DONATION_FUNDS_MANAGE],
  },
  {
    href: '/admin/events',
    labelKey: 'nav_events',
    match: 'prefix',
    permissions: [Permission.EVENTS_MANAGE, Permission.EVENTS_ASSIGNED_MANAGE],
  },
  {
    href: '/admin/payments',
    labelKey: 'nav_payments',
    match: 'prefix',
    permissions: [Permission.PAYMENTS_VIEW],
  },
  {
    href: '/admin/event_categories',
    labelKey: 'nav_event_categories',
    match: 'prefix',
    permissions: [Permission.EVENT_CATEGORIES_MANAGE],
  },
  {
    href: '/admin/class_categories',
    labelKey: 'nav_class_categories',
    match: 'prefix',
    permissions: [Permission.CLASS_CATEGORIES_MANAGE],
  },
  {
    href: '/admin/sailing_classes',
    labelKey: 'nav_sailing_classes',
    match: 'prefix',
    permissions: [Permission.SAILING_CLASSES_MANAGE],
  },
  {
    href: '/admin/sailing_ratings',
    labelKey: 'nav_sailing_ratings',
    match: 'prefix',
    permissions: [Permission.SAILING_RATINGS_MANAGE],
  },
  {
    href: '/admin/sailing_rating_rules',
    labelKey: 'nav_sailing_rating_rules',
    match: 'prefix',
    permissions: [Permission.SAILING_RATING_RULES_MANAGE],
  },
  {
    href: '/admin/fleet',
    labelKey: 'nav_fleet',
    match: 'prefix',
    permissions: [Permission.FLEET_MANAGE],
  },
  {
    href: '/admin/site_alerts',
    labelKey: 'nav_site_alerts',
    match: 'prefix',
    permissions: [Permission.SITE_ALERTS_MANAGE],
  },
  {
    href: '/admin/cms_pages',
    labelKey: 'nav_cms_pages',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    href: '/admin/cms_page_blocks',
    labelKey: 'nav_cms_page_blocks',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    href: '/admin/cms_menus',
    labelKey: 'nav_cms_menus',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    href: '/admin/cms_menu_items',
    labelKey: 'nav_cms_menu_items',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
];

export function adminNavItemsForPermissions(
  permissions: readonly Permission[]
): AdminNavItem[] {
  return ADMIN_SITE_NAV_ITEMS.filter((item) =>
    hasAnyPermission(permissions, item.permissions)
  );
}
