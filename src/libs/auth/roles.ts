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

const ROLE_VALUES = Object.values(Role) as Role[];

export const ROLE_DEFINITIONS = [
  { key: Role.USER, label: 'User' },
  { key: Role.VOLUNTEER, label: 'Volunteer' },
  { key: Role.VOLUNTEER_INSTRUCTOR, label: 'Volunteer instructor' },
  { key: Role.DOCK_STAFF, label: 'Dock staff' },
  { key: Role.DOCK_MASTER, label: 'Dock master' },
  { key: Role.ADMIN, label: 'Administrator' },
] as const satisfies readonly { key: Role; label: string }[];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as string[]).includes(value);
}

/**
 * Parses Better Auth's comma-separated role column into known app roles.
 *
 * @param role - Raw role from session or DB
 * @returns Known roles, defaulting to user when none are valid
 */
export function parseRoles(role: unknown): Role[] {
  if (typeof role !== 'string') {
    return [Role.USER];
  }
  const roles = role
    .split(',')
    .map((value) => value.trim())
    .filter(isRole);
  const uniqueRoles = [...new Set(roles)];
  return uniqueRoles.length > 0 ? uniqueRoles : [Role.USER];
}

/**
 * Maps persisted or API role strings onto a primary {@link Role}, defaulting to user.
 * Admin wins so Better Auth multi-role values still satisfy legacy admin checks.
 *
 * @param role - Raw role from session or DB
 * @returns Normalized role
 */
export function normalizeRole(role: unknown): Role {
  const roles = parseRoles(role);
  if (roles.includes(Role.ADMIN)) {
    return Role.ADMIN;
  }
  return roles[0] ?? Role.USER;
}
