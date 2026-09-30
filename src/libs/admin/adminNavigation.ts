import { hasAnyPermission, Permission } from '@/libs/auth/appPermissions';
import type messages from '@/locales/en.json';

type AdminNavGroupId = 'catalog' | 'content' | 'operations';

export type AdminNavItem = {
  group?: AdminNavGroupId;
  href: string;
  labelKey: keyof typeof messages.AdminSideNav;
  match: 'exact' | 'prefix';
  permissions: readonly Permission[];
};

export type AdminNavGroup = {
  id: AdminNavGroupId;
  labelKey: keyof typeof messages.AdminSideNav;
  items: AdminNavItem[];
};

const ADMIN_SITE_NAV_ITEMS: AdminNavItem[] = [
  {
    href: '/admin',
    labelKey: 'nav_admin',
    match: 'exact',
    permissions: [Permission.ADMIN_VIEW],
  },
  {
    group: 'operations',
    href: '/admin/users',
    labelKey: 'nav_users',
    match: 'prefix',
    permissions: [Permission.USERS_VIEW],
  },
  {
    group: 'operations',
    href: '/admin/pavilion-reservations',
    labelKey: 'nav_pavilion_reservations',
    match: 'prefix',
    permissions: [Permission.PAVILION_RESERVATIONS_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/pavilion_spaces',
    labelKey: 'nav_pavilion_spaces',
    match: 'prefix',
    permissions: [Permission.PAVILION_RESERVATIONS_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/events',
    labelKey: 'nav_events',
    match: 'prefix',
    permissions: [Permission.EVENTS_MANAGE, Permission.EVENTS_ASSIGNED_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/payments',
    labelKey: 'nav_payments',
    match: 'prefix',
    permissions: [Permission.PAYMENTS_VIEW],
  },
  {
    group: 'operations',
    href: '/admin/newsletter-subscribers',
    labelKey: 'nav_newsletter_subscribers',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/newsletter-lists',
    labelKey: 'nav_newsletter_lists',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/newsletter-broadcasts',
    labelKey: 'nav_newsletter_broadcasts',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/newsletter-templates',
    labelKey: 'nav_newsletter_templates',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    group: 'operations',
    href: '/admin/email-templates',
    labelKey: 'nav_email_templates',
    match: 'prefix',
    permissions: [Permission.NEWSLETTER_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/donation_funds',
    labelKey: 'nav_donation_funds',
    match: 'prefix',
    permissions: [Permission.DONATION_FUNDS_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/event_categories',
    labelKey: 'nav_event_categories',
    match: 'prefix',
    permissions: [Permission.EVENT_CATEGORIES_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/class_categories',
    labelKey: 'nav_class_categories',
    match: 'prefix',
    permissions: [Permission.CLASS_CATEGORIES_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/sailing_classes',
    labelKey: 'nav_sailing_classes',
    match: 'prefix',
    permissions: [Permission.SAILING_CLASSES_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/sailing_ratings',
    labelKey: 'nav_sailing_ratings',
    match: 'prefix',
    permissions: [Permission.SAILING_RATINGS_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/sailing_rating_rules',
    labelKey: 'nav_sailing_rating_rules',
    match: 'prefix',
    permissions: [Permission.SAILING_RATING_RULES_MANAGE],
  },
  {
    group: 'catalog',
    href: '/admin/fleet',
    labelKey: 'nav_fleet',
    match: 'prefix',
    permissions: [Permission.FLEET_MANAGE],
  },
  {
    group: 'content',
    href: '/admin/site_alerts',
    labelKey: 'nav_site_alerts',
    match: 'prefix',
    permissions: [Permission.SITE_ALERTS_MANAGE],
  },
  {
    group: 'content',
    href: '/admin/cms_pages',
    labelKey: 'nav_cms_pages',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    group: 'content',
    href: '/admin/cms_page_blocks',
    labelKey: 'nav_cms_page_blocks',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    group: 'content',
    href: '/admin/cms_menus',
    labelKey: 'nav_cms_menus',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
  {
    group: 'content',
    href: '/admin/cms_menu_items',
    labelKey: 'nav_cms_menu_items',
    match: 'prefix',
    permissions: [Permission.CMS_VIEW],
  },
];

const ADMIN_NAV_GROUP_ORDER: readonly AdminNavGroupId[] = [
  'operations',
  'catalog',
  'content',
];

const ADMIN_NAV_GROUP_LABELS: Record<
  AdminNavGroupId,
  keyof typeof messages.AdminSideNav
> = {
  catalog: 'group_catalog',
  content: 'group_content',
  operations: 'group_operations',
};

export function adminNavItemsForPermissions(
  permissions: readonly Permission[]
): AdminNavItem[] {
  return ADMIN_SITE_NAV_ITEMS.filter((item) =>
    hasAnyPermission(permissions, item.permissions)
  );
}

/**
 * Groups permission-filtered nav items for the admin sidebar.
 *
 * @param permissions - Current user permissions
 * @returns Sidebar groups with visible items only
 */
export function adminNavGroupsForPermissions(
  permissions: readonly Permission[]
): AdminNavGroup[] {
  const visibleItems = adminNavItemsForPermissions(permissions);
  return ADMIN_NAV_GROUP_ORDER.flatMap((groupId) => {
    const items = visibleItems.filter((item) => item.group === groupId);
    if (items.length === 0) {
      return [];
    }
    return [
      {
        id: groupId,
        items,
        labelKey: ADMIN_NAV_GROUP_LABELS[groupId],
      },
    ];
  });
}

/**
 * Returns the first concrete admin route for a permission-filtered nav list.
 *
 * @param navItems - Visible sidebar items for the current user
 * @returns Path to redirect `/admin` to, excluding the index itself
 */
export function adminLandingPath(navItems: readonly AdminNavItem[]): string {
  const landing = navItems.find((item) => item.href !== '/admin');
  if (!landing) {
    return '/admin/users';
  }
  return landing.href;
}
