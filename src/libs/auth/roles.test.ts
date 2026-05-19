import { describe, expect, it } from 'vitest';
import {
  normalizeRole,
  Role,
  ROLE_DEFINITIONS,
  ROLE_VALUES,
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
    expect(normalizeRole('admin,dock_staff')).toBe(Role.USER);
  });
});

describe('ROLE_VALUES', () => {
  it('contains supported single roles', () => {
    expect(ROLE_VALUES).toEqual([
      Role.USER,
      Role.VOLUNTEER,
      Role.VOLUNTEER_INSTRUCTOR,
      Role.DOCK_STAFF,
      Role.DOCK_MASTER,
      Role.ADMIN,
    ]);
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
