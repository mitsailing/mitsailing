import type { PureAbility } from '@casl/ability';
import { AbilityBuilder, subject } from '@casl/ability';
import { createPrismaAbilityFor } from '@casl/prisma';
import type { PrismaQueryOf, Subjects } from '@casl/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { Role } from '@/libs/auth/roles';

export const Permission = {
  ADMIN_VIEW: 'admin.view',
  USERS_VIEW: 'users.view',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  EVENTS_CREATE: 'events.create',
  EVENTS_MANAGE: 'events.manage',
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
  CARDS_REVIEW: 'cards.review',
  CARDS_APPROVE: 'cards.approve',
  CARDS_ASSIGN_NUMBER: 'cards.assignNumber',
  CARDS_PRINT: 'cards.print',
  CARDS_EXPIRE: 'cards.expire',
  PAYMENTS_VIEW: 'payments.view',
  PAYMENTS_OVERRIDE: 'payments.override',
  WAREHOUSE_VIEW: 'warehouse.view',
  WAREHOUSE_SYNC: 'warehouse.sync',
  ROLES_ASSIGN: 'roles.assign',
  ROLES_MANAGE_PERMISSIONS: 'roles.managePermissions',
  ELIGIBILITY_VERIFY_GYM_MEMBERSHIP: 'eligibility.verifyGymMembership',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

export const AuthAction = {
  MANAGE: 'manage',
  UPDATE: 'update',
} as const;
export type AuthAction = (typeof AuthAction)[keyof typeof AuthAction];

export const AuthSubject = {
  PERMISSION: 'Permission',
  EVENT: 'Event',
  EVENT_REGISTRATION: 'EventRegistration',
} as const;
export type AuthSubject = (typeof AuthSubject)[keyof typeof AuthSubject];

export type EventAbilityRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
  createdByUserId: string;
};

export type EventRegistrationAbilityRecord = {
  userId: string;
};

type PrismaAbilitySubjects = Subjects<{
  Event: EventAbilityRecord;
  EventRegistration: EventRegistrationAbilityRecord;
}>;
type AbilitySubject =
  | 'all'
  | typeof AuthSubject.PERMISSION
  | PrismaAbilitySubjects;
type AbilityAction = Permission | AuthAction;

export type AuthAbility = PureAbility<
  [AbilityAction, AbilitySubject],
  PrismaQueryOf<Prisma.TypeMap>
>;
const createPrismaAuthAbility = createPrismaAbilityFor<Prisma.TypeMap>();

const ALL_PERMISSIONS = Object.values(Permission) as Permission[];
export const ROLE_PERMISSION_GRANT_ROLES = [
  Role.VOLUNTEER,
  Role.VOLUNTEER_INSTRUCTOR,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
] as const;
const ROLE_GRANTABLE_PERMISSIONS = ALL_PERMISSIONS;

export type RolePermissionGrant = {
  roleKey: Role;
  permissionKey: Permission;
};

export const PERMISSION_DEFINITIONS = [
  {
    key: Permission.ADMIN_VIEW,
    groupKey: 'group_administration',
    labelKey: 'permission_admin_view',
  },
  {
    key: Permission.USERS_VIEW,
    groupKey: 'group_users',
    labelKey: 'permission_users_view',
  },
  {
    key: Permission.USERS_EDIT,
    groupKey: 'group_users',
    labelKey: 'permission_users_edit',
  },
  {
    key: Permission.USERS_DELETE,
    groupKey: 'group_users',
    labelKey: 'permission_users_delete',
  },
  {
    key: Permission.EVENTS_CREATE,
    groupKey: 'group_events',
    labelKey: 'permission_events_create',
  },
  {
    key: Permission.EVENTS_MANAGE,
    groupKey: 'group_events',
    labelKey: 'permission_events_manage',
  },
  {
    key: Permission.PAVILION_RESERVATIONS_MANAGE,
    groupKey: 'group_reservations',
    labelKey: 'permission_pavilionReservations_manage',
  },
  {
    key: Permission.NEWSLETTER_MANAGE,
    groupKey: 'group_newsletters',
    labelKey: 'permission_newsletter_manage',
  },
  {
    key: Permission.DONATION_FUNDS_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_donationFunds_manage',
  },
  {
    key: Permission.EVENT_CATEGORIES_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_eventCategories_manage',
  },
  {
    key: Permission.CLASS_CATEGORIES_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_classCategories_manage',
  },
  {
    key: Permission.FLEET_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_fleet_manage',
  },
  {
    key: Permission.SAILING_CLASSES_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_sailingClasses_manage',
  },
  {
    key: Permission.SAILING_RATINGS_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_sailingRatings_manage',
  },
  {
    key: Permission.SAILING_RATING_RULES_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_sailingRatingRules_manage',
  },
  {
    key: Permission.SITE_ALERTS_MANAGE,
    groupKey: 'group_catalog',
    labelKey: 'permission_siteAlerts_manage',
  },
  {
    key: Permission.CMS_VIEW,
    groupKey: 'group_cms',
    labelKey: 'permission_cms_view',
  },
  {
    key: Permission.CMS_EDIT,
    groupKey: 'group_cms',
    labelKey: 'permission_cms_edit',
  },
  {
    key: Permission.CMS_DELETE,
    groupKey: 'group_cms',
    labelKey: 'permission_cms_delete',
  },
  {
    key: Permission.RATINGS_ASSIGN,
    groupKey: 'group_ratings',
    labelKey: 'permission_ratings_assign',
  },
  {
    key: Permission.CARDS_REVIEW,
    groupKey: 'group_cards',
    labelKey: 'permission_cards_review',
  },
  {
    key: Permission.CARDS_APPROVE,
    groupKey: 'group_cards',
    labelKey: 'permission_cards_approve',
  },
  {
    key: Permission.CARDS_ASSIGN_NUMBER,
    groupKey: 'group_cards',
    labelKey: 'permission_cards_assignNumber',
  },
  {
    key: Permission.CARDS_PRINT,
    groupKey: 'group_cards',
    labelKey: 'permission_cards_print',
  },
  {
    key: Permission.CARDS_EXPIRE,
    groupKey: 'group_cards',
    labelKey: 'permission_cards_expire',
  },
  {
    key: Permission.PAYMENTS_VIEW,
    groupKey: 'group_payments',
    labelKey: 'permission_payments_view',
  },
  {
    key: Permission.PAYMENTS_OVERRIDE,
    groupKey: 'group_payments',
    labelKey: 'permission_payments_override',
  },
  {
    key: Permission.WAREHOUSE_VIEW,
    groupKey: 'group_warehouse',
    labelKey: 'permission_warehouse_view',
  },
  {
    key: Permission.WAREHOUSE_SYNC,
    groupKey: 'group_warehouse',
    labelKey: 'permission_warehouse_sync',
  },
  {
    key: Permission.ROLES_ASSIGN,
    groupKey: 'group_permissions',
    labelKey: 'permission_roles_assign',
  },
  {
    key: Permission.ROLES_MANAGE_PERMISSIONS,
    groupKey: 'group_permissions',
    labelKey: 'permission_roles_managePermissions',
  },
  {
    key: Permission.ELIGIBILITY_VERIFY_GYM_MEMBERSHIP,
    groupKey: 'group_eligibility',
    labelKey: 'permission_eligibility_verifyGymMembership',
  },
] as const satisfies readonly {
  key: Permission;
  groupKey: string;
  labelKey: string;
}[];
export type PermissionDefinition = (typeof PERMISSION_DEFINITIONS)[number];

const CONSERVATIVE_LAUNCH_GRANTS: RolePermissionGrant[] = [
  { roleKey: Role.VOLUNTEER_INSTRUCTOR, permissionKey: Permission.ADMIN_VIEW },
  { roleKey: Role.VOLUNTEER_INSTRUCTOR, permissionKey: Permission.USERS_VIEW },
  {
    roleKey: Role.VOLUNTEER_INSTRUCTOR,
    permissionKey: Permission.EVENTS_CREATE,
  },
  {
    roleKey: Role.VOLUNTEER_INSTRUCTOR,
    permissionKey: Permission.RATINGS_ASSIGN,
  },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.ADMIN_VIEW },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.USERS_VIEW },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.EVENTS_MANAGE },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.CARDS_REVIEW },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.CARDS_APPROVE },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.CARDS_ASSIGN_NUMBER },
  { roleKey: Role.DOCK_STAFF, permissionKey: Permission.CARDS_PRINT },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.ADMIN_VIEW },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.USERS_VIEW },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.EVENTS_MANAGE },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.CARDS_REVIEW },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.CARDS_APPROVE },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.CARDS_ASSIGN_NUMBER },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.CARDS_PRINT },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.CARDS_EXPIRE },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.PAYMENTS_VIEW },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.WAREHOUSE_VIEW },
  { roleKey: Role.DOCK_MASTER, permissionKey: Permission.WAREHOUSE_SYNC },
  {
    roleKey: Role.DOCK_MASTER,
    permissionKey: Permission.ELIGIBILITY_VERIFY_GYM_MEMBERSHIP,
  },
];

export function isKnownPermission(
  permission: unknown
): permission is Permission {
  return (
    typeof permission === 'string' &&
    (ALL_PERMISSIONS as string[]).includes(permission)
  );
}

function isKnownRole(role: unknown): role is Role {
  return (
    typeof role === 'string' && (Object.values(Role) as string[]).includes(role)
  );
}

export function isRolePermissionGrantRole(role: Role): boolean {
  return (ROLE_PERMISSION_GRANT_ROLES as readonly Role[]).includes(role);
}

export function isRoleGrantablePermission(permission: Permission): boolean {
  return (ROLE_GRANTABLE_PERMISSIONS as readonly Permission[]).includes(
    permission
  );
}

export function permissionGrantsForSeed(): RolePermissionGrant[] {
  return [...CONSERVATIVE_LAUNCH_GRANTS];
}

export function normalizeRolePermissionGrant(input: {
  roleKey: string;
  permissionKey: string;
}): RolePermissionGrant | null {
  if (!(isKnownRole(input.roleKey) && isKnownPermission(input.permissionKey))) {
    return null;
  }
  if (!isRolePermissionGrantRole(input.roleKey)) {
    return null;
  }
  if (!isRoleGrantablePermission(input.permissionKey)) {
    return null;
  }
  return {
    roleKey: input.roleKey,
    permissionKey: input.permissionKey,
  };
}

export function createEventAbilitySubject(props: EventAbilityRecord) {
  return subject(AuthSubject.EVENT, props);
}

export function createEventRegistrationAbilitySubject(
  props: EventRegistrationAbilityRecord
) {
  return subject(AuthSubject.EVENT_REGISTRATION, props);
}

function rolesHavePermission(props: {
  grants: readonly RolePermissionGrant[];
  permission: Permission;
  roles: readonly Role[];
}): boolean {
  if (props.roles.includes(Role.ADMIN)) {
    return true;
  }
  return props.grants.some(
    (grant) =>
      grant.permissionKey === props.permission &&
      props.roles.includes(grant.roleKey)
  );
}

export function createAuthAbility(props: {
  grants: readonly RolePermissionGrant[];
  role?: Role;
  roles?: readonly Role[];
  userId?: string | null;
}): AuthAbility {
  const { can, build } = new AbilityBuilder<AuthAbility>(
    createPrismaAuthAbility
  );
  const roles = props.roles ?? (props.role ? [props.role] : [Role.USER]);

  if (roles.includes(Role.ADMIN)) {
    can(AuthAction.MANAGE, 'all');
    return build();
  }

  for (const grant of props.grants) {
    if (roles.includes(grant.roleKey)) {
      can(grant.permissionKey, AuthSubject.PERMISSION);
    }
  }

  if (!props.userId) {
    return build();
  }
  const { userId } = props;

  can(AuthAction.UPDATE, AuthSubject.EVENT_REGISTRATION, { userId });

  if (
    rolesHavePermission({
      grants: props.grants,
      permission: Permission.EVENTS_MANAGE,
      roles,
    })
  ) {
    can(AuthAction.UPDATE, AuthSubject.EVENT);
  } else if (
    rolesHavePermission({
      grants: props.grants,
      permission: Permission.EVENTS_CREATE,
      roles,
    })
  ) {
    can(AuthAction.UPDATE, AuthSubject.EVENT, {
      admins: { some: { adminUserId: userId } },
    });
  }

  return build();
}
