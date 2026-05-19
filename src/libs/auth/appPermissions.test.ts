import { describe, expect, it } from 'vitest';
import {
  Permission,
  getAppRolePermissions,
  hasAnyPermission,
  hasPermission,
  isAdminAppRole,
  normalizeAppRole,
} from '@/libs/auth/appPermissions';
import { Role } from '@/libs/auth/roles';

describe('app permissions', () => {
  it('fails closed to user for blank and unknown roles', () => {
    expect(normalizeAppRole('')).toBe(Role.USER);
    expect(normalizeAppRole(null)).toBe(Role.USER);
    expect(normalizeAppRole('admin,dock_staff')).toBe(Role.USER);
    expect(normalizeAppRole('unknown')).toBe(Role.USER);
  });

  it('grants admin every permission', () => {
    const permissions = getAppRolePermissions(Role.ADMIN);

    expect(isAdminAppRole(Role.ADMIN)).toBe(true);
    expect(hasPermission(permissions, Permission.USERS_DELETE)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(true);
  });

  it('allows dock staff into operational admin without role assignment', () => {
    const permissions = getAppRolePermissions(Role.DOCK_STAFF);

    expect(hasPermission(permissions, Permission.ADMIN_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(true);
    expect(isAdminAppRole(Role.DOCK_STAFF)).toBe(false);
  });

  it('checks any permission', () => {
    const permissions = getAppRolePermissions(Role.VOLUNTEER_INSTRUCTOR);

    expect(
      hasAnyPermission(permissions, [
        Permission.EVENTS_MANAGE,
        Permission.RATINGS_ASSIGN,
      ])
    ).toBe(true);
  });
});
