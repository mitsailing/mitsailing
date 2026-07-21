import { Role, isRole } from '@/libs/auth/roles';

export const Permission = {
  ADMIN_VIEW: 'admin.view',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  EVENTS_MANAGE: 'events.manage',
  EVENTS_ASSIGNED_MANAGE: 'events.assignedManage',
  PAVILION_RESERVATIONS_MANAGE: 'pavilionReservations.manage',
  NEWSLETTER_MANAGE: 'newsletter.manage',
  DONATION_FUNDS_MANAGE: 'donationFunds.manage',
  EVENT_CATEGORIES_MANAGE: 'eventCategories.manage',
  CLASS_CATEGORIES_MANAGE: 'classCategories.manage',
  FLEET_MANAGE: 'fleet.manage',
  SAILING_CLASSES_MANAGE: 'sailingClasses.manage',
  SAILING_RATINGS_MANAGE: 'sailingRatings.manage',
  SAILING_RATING_RULES_MANAGE: 'sailingRatingRules.manage',
  SITE_ALERTS_MANAGE: 'siteAlerts.manage',
  CMS_VIEW: 'cms.view',
  CMS_EDIT: 'cms.edit',
  CMS_DELETE: 'cms.delete',
  RATINGS_ASSIGN: 'ratings.assign',
  CARDS_ASSIGN_NUMBER: 'cards.assignNumber',
  CARDS_PRINT: 'cards.print',
  CARDS_EXPIRE: 'cards.expire',
  PAYMENTS_VIEW: 'payments.view',
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_SYNC: 'warehouse.sync',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ALL_PERMISSIONS = Object.values(Permission) as readonly Permission[];

const ROLE_PERMISSIONS = {
  [Role.USER]: [],
  [Role.VOLUNTEER]: [],
  [Role.VOLUNTEER_INSTRUCTOR]: [
    Permission.ADMIN_VIEW,
    Permission.USERS_VIEW,
    Permission.EVENTS_ASSIGNED_MANAGE,
    Permission.RATINGS_ASSIGN,
    Permission.CARDS_ASSIGN_NUMBER,
    Permission.CARDS_PRINT,
  ],
  [Role.DOCK_STAFF]: [
    Permission.ADMIN_VIEW,
    Permission.USERS_VIEW,
    Permission.EVENTS_MANAGE,
    Permission.RATINGS_ASSIGN,
    Permission.CARDS_ASSIGN_NUMBER,
    Permission.CARDS_PRINT,
    Permission.CARDS_EXPIRE,
  ],
  [Role.DOCK_MASTER]: [
    Permission.ADMIN_VIEW,
    Permission.USERS_VIEW,
    Permission.EVENTS_MANAGE,
    Permission.RATINGS_ASSIGN,
    Permission.CARDS_ASSIGN_NUMBER,
    Permission.CARDS_PRINT,
    Permission.CARDS_EXPIRE,
    Permission.PAYMENTS_VIEW,
    Permission.WAREHOUSE_VIEW,
    Permission.WAREHOUSE_SYNC,
  ],
  [Role.ADMIN]: ALL_PERMISSIONS,
} as const satisfies Record<Role, readonly Permission[]>;

export function normalizeAppRole(value: unknown): Role {
  return isRole(value) ? value : Role.USER;
}

export function getAppRolePermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(
  permissions: readonly Permission[],
  permission: Permission
): boolean {
  return permissions.includes(permission);
}

export function hasAnyPermission(
  permissions: readonly Permission[],
  required: readonly Permission[]
): boolean {
  return required.some((permission) => permissions.includes(permission));
}

export function isAdminAppRole(role: Role): boolean {
  return role === Role.ADMIN;
}
