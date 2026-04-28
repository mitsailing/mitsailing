/**
 * Role string-union kept as a TypeScript `as const` map instead of a Prisma
 * enum so Better Auth's admin plugin can consume the `user.role` column as a
 * plain string without extra casting.
 */
export const Role = { USER: 'user', ADMIN: 'admin' } as const;
export type Role = (typeof Role)[keyof typeof Role];

const ROLE_VALUES = Object.values(Role) as Role[];

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLE_VALUES as string[]).includes(value);
}
