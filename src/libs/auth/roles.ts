/**
 * Role string-union kept as a TypeScript `as const` map instead of a Prisma
 * enum so Better Auth's admin plugin can consume the `user.role` column as a
 * plain string without extra casting.
 */
export const Role = {
  USER: 'user',
  VOLUNTEER: 'volunteer',
  VOLUNTEER_INSTRUCTOR: 'volunteer_instructor',
  DOCK_STAFF: 'dock_staff',
  DOCK_MASTER: 'dock_master',
  ADMIN: 'admin',
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const ROLE_DEFINITIONS = [
  { key: Role.USER, labelKey: 'role_user' },
  { key: Role.VOLUNTEER, labelKey: 'role_volunteer' },
  {
    key: Role.VOLUNTEER_INSTRUCTOR,
    labelKey: 'role_volunteer_instructor',
  },
  { key: Role.DOCK_STAFF, labelKey: 'role_dock_staff' },
  { key: Role.DOCK_MASTER, labelKey: 'role_dock_master' },
  { key: Role.ADMIN, labelKey: 'role_admin' },
] as const satisfies readonly { key: Role; labelKey: string }[];

export const ROLE_VALUES = [
  Role.USER,
  Role.VOLUNTEER,
  Role.VOLUNTEER_INSTRUCTOR,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
  Role.ADMIN,
] as const;

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' &&
    (ROLE_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Maps persisted or API role strings onto a single {@link Role}, defaulting to user.
 *
 * @param role - Raw role from session or DB
 * @returns Normalized role
 */
export function normalizeRole(role: unknown): Role {
  return isRole(role) ? role : Role.USER;
}
