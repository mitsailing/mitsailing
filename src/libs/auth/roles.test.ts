import { describe, expect, it } from 'vitest';
import {
  normalizeRole,
  parseRoles,
  Role,
  ROLE_DEFINITIONS,
} from '@/libs/auth/roles';

describe('normalizeRole', () => {
  it('preserves known roles for admin and user', () => {
    expect(normalizeRole(Role.ADMIN)).toBe(Role.ADMIN);
    expect(normalizeRole(Role.USER)).toBe(Role.USER);
  });

  it('defaults unknown roles to user', () => {
    const missingRole: unknown = undefined;
    expect(normalizeRole('super-admin')).toBe(Role.USER);
    expect(normalizeRole(null)).toBe(Role.USER);
    expect(normalizeRole(missingRole)).toBe(Role.USER);
    expect(normalizeRole('')).toBe(Role.USER);
  });
});

describe('parseRoles', () => {
  it('parses comma-separated Better Auth roles', () => {
    expect(
      parseRoles('volunteer_instructor,dock_staff,unknown, volunteer')
    ).toEqual([Role.VOLUNTEER_INSTRUCTOR, Role.DOCK_STAFF, Role.VOLUNTEER]);
  });

  it('defaults missing and empty role strings to user', () => {
    expect(parseRoles(null)).toEqual([Role.USER]);
    expect(parseRoles('')).toEqual([Role.USER]);
    expect(parseRoles('unknown')).toEqual([Role.USER]);
  });
});

describe('ROLE_DEFINITIONS', () => {
  it('keeps role labels as translation keys', () => {
    expect(ROLE_DEFINITIONS).toContainEqual({
      key: Role.DOCK_STAFF,
      labelKey: 'role_dock_staff',
    });
  });
});
