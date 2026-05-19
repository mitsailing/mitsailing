import type { PureAbility } from '@casl/ability';
import { AbilityBuilder, subject } from '@casl/ability';
import { createPrismaAbilityFor } from '@casl/prisma';
import type { PrismaQueryOf, Subjects } from '@casl/prisma';
import type { Prisma } from '@/generated/prisma/client';
import { Permission, getAppRolePermissions } from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';

export { Permission } from '@/libs/auth/appPermissions';

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
    key: Permission.ELIGIBILITY_VERIFY_GYM_MEMBERSHIP,
    groupKey: 'group_eligibility',
    labelKey: 'permission_eligibility_verifyGymMembership',
  },
] as const satisfies readonly {
  key: Permission;
  groupKey: string;
  labelKey: string;
}[];

export function createEventAbilitySubject(props: EventAbilityRecord) {
  return subject(AuthSubject.EVENT, props);
}

export function createEventRegistrationAbilitySubject(
  props: EventRegistrationAbilityRecord
) {
  return subject(AuthSubject.EVENT_REGISTRATION, props);
}

export function createAuthAbility(props: {
  role?: Role;
  userId?: string | null;
}): AuthAbility {
  const { can, build } = new AbilityBuilder<AuthAbility>(
    createPrismaAuthAbility
  );
  const role = props.role ?? Role.USER;
  const rolePermissions = getAppRolePermissions(role);

  if (role === Role.ADMIN) {
    can(AuthAction.MANAGE, 'all');
    return build();
  }

  for (const permission of rolePermissions) {
    can(permission, AuthSubject.PERMISSION);
  }

  if (!props.userId) {
    return build();
  }
  const { userId } = props;

  can(AuthAction.UPDATE, AuthSubject.EVENT_REGISTRATION, { userId });
  can(AuthAction.UPDATE, AuthSubject.EVENT, {
    admins: { some: { adminUserId: userId } },
  });

  if (rolePermissions.includes(Permission.EVENTS_MANAGE)) {
    can(AuthAction.UPDATE, AuthSubject.EVENT);
  }

  return build();
}
