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
    group: 'Administration',
    label: 'Open admin area',
  },
  { key: Permission.USERS_VIEW, group: 'Users', label: 'View users' },
  { key: Permission.USERS_EDIT, group: 'Users', label: 'Edit users' },
  { key: Permission.USERS_DELETE, group: 'Users', label: 'Delete users' },
  {
    key: Permission.EVENTS_CREATE,
    group: 'Events',
    label: 'Create events',
  },
  {
    key: Permission.EVENTS_MANAGE,
    group: 'Events',
    label: 'Manage events',
  },
  {
    key: Permission.PAVILION_RESERVATIONS_MANAGE,
    group: 'Reservations',
    label: 'Manage pavilion reservations',
  },
  {
    key: Permission.NEWSLETTER_MANAGE,
    group: 'Newsletters',
    label: 'Manage newsletters',
  },
  {
    key: Permission.DONATION_FUNDS_MANAGE,
    group: 'Catalog',
    label: 'Manage donation funds',
  },
  {
    key: Permission.EVENT_CATEGORIES_MANAGE,
    group: 'Catalog',
    label: 'Manage event categories',
  },
  {
    key: Permission.CLASS_CATEGORIES_MANAGE,
    group: 'Catalog',
    label: 'Manage class categories',
  },
  { key: Permission.FLEET_MANAGE, group: 'Catalog', label: 'Manage fleet' },
  {
    key: Permission.SAILING_CLASSES_MANAGE,
    group: 'Catalog',
    label: 'Manage sailing classes',
  },
  {
    key: Permission.SAILING_RATINGS_MANAGE,
    group: 'Catalog',
    label: 'Manage sailing ratings',
  },
  {
    key: Permission.SAILING_RATING_RULES_MANAGE,
    group: 'Catalog',
    label: 'Manage sailing rating rules',
  },
  {
    key: Permission.SITE_ALERTS_MANAGE,
    group: 'Catalog',
    label: 'Manage site alerts',
  },
  { key: Permission.CMS_VIEW, group: 'CMS', label: 'View CMS' },
  { key: Permission.CMS_EDIT, group: 'CMS', label: 'Edit CMS' },
  { key: Permission.CMS_DELETE, group: 'CMS', label: 'Delete CMS' },
  {
    key: Permission.RATINGS_ASSIGN,
    group: 'Ratings',
    label: 'Assign sailing ratings',
  },
  { key: Permission.CARDS_REVIEW, group: 'Cards', label: 'Review cards' },
  { key: Permission.CARDS_APPROVE, group: 'Cards', label: 'Approve cards' },
  {
    key: Permission.CARDS_ASSIGN_NUMBER,
    group: 'Cards',
    label: 'Assign card numbers',
  },
  { key: Permission.CARDS_PRINT, group: 'Cards', label: 'Print cards' },
  { key: Permission.CARDS_EXPIRE, group: 'Cards', label: 'Expire cards' },
  { key: Permission.PAYMENTS_VIEW, group: 'Payments', label: 'View payments' },
  {
    key: Permission.PAYMENTS_OVERRIDE,
    group: 'Payments',
    label: 'Override payments',
  },
  {
    key: Permission.WAREHOUSE_VIEW,
    group: 'Warehouse',
    label: 'View warehouse status',
  },
  {
    key: Permission.WAREHOUSE_SYNC,
    group: 'Warehouse',
    label: 'Run warehouse sync',
  },
  { key: Permission.ROLES_ASSIGN, group: 'Permissions', label: 'Assign roles' },
  {
    key: Permission.ROLES_MANAGE_PERMISSIONS,
    group: 'Permissions',
    label: 'Manage role permissions',
  },
  {
    key: Permission.ELIGIBILITY_VERIFY_GYM_MEMBERSHIP,
    group: 'Eligibility',
    label: 'Verify gym membership',
  },
] as const satisfies readonly {
  key: Permission;
  group: string;
  label: string;
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

function roleHasPermission(props: {
  grants: readonly RolePermissionGrant[];
  permission: Permission;
  role: Role;
}): boolean {
  if (props.role === Role.ADMIN) {
    return true;
  }
  return props.grants.some(
    (grant) =>
      grant.permissionKey === props.permission && grant.roleKey === props.role
  );
}

export function createAuthAbility(props: {
  grants: readonly RolePermissionGrant[];
  role: Role;
  userId?: string | null;
}): AuthAbility {
  const { can, build } = new AbilityBuilder<AuthAbility>(
    createPrismaAuthAbility
  );

  if (props.role === Role.ADMIN) {
    can(AuthAction.MANAGE, 'all');
    return build();
  }

  for (const grant of props.grants) {
    if (grant.roleKey === props.role) {
      can(grant.permissionKey, AuthSubject.PERMISSION);
    }
  }

  if (!props.userId) {
    return build();
  }
  const { userId } = props;

  can(AuthAction.UPDATE, AuthSubject.EVENT_REGISTRATION, { userId });

  if (
    roleHasPermission({
      grants: props.grants,
      permission: Permission.EVENTS_MANAGE,
      role: props.role,
    })
  ) {
    can(AuthAction.UPDATE, AuthSubject.EVENT);
  } else if (
    props.role === Role.VOLUNTEER_INSTRUCTOR &&
    roleHasPermission({
      grants: props.grants,
      permission: Permission.EVENTS_CREATE,
      role: props.role,
    })
  ) {
    can(AuthAction.UPDATE, AuthSubject.EVENT, {
      admins: { some: { adminUserId: userId } },
    });
  }

  return build();
}
