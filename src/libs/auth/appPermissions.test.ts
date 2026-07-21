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

  it('blocks volunteers from admin access', () => {
    const permissions = getAppRolePermissions(Role.VOLUNTEER);

    expect(hasPermission(permissions, Permission.ADMIN_VIEW)).toBe(false);
    expect(hasPermission(permissions, Permission.USERS_VIEW)).toBe(false);
  });

  it('allows dock staff into operational admin without role assignment', () => {
    const permissions = getAppRolePermissions(Role.DOCK_STAFF);

    expect(hasPermission(permissions, Permission.ADMIN_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(true);
    expect(hasPermission(permissions, Permission.RATINGS_ASSIGN)).toBe(true);
    expect(hasPermission(permissions, Permission.USERS_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.CARDS_EXPIRE)).toBe(true);
    expect(isAdminAppRole(Role.DOCK_STAFF)).toBe(false);
  });

  it('allows dock master to assign ratings and expire cards', () => {
    const permissions = getAppRolePermissions(Role.DOCK_MASTER);

    expect(hasPermission(permissions, Permission.RATINGS_ASSIGN)).toBe(true);
    expect(hasPermission(permissions, Permission.CARDS_EXPIRE)).toBe(true);
    expect(hasPermission(permissions, Permission.PAYMENTS_VIEW)).toBe(true);
  });

  it('allows volunteer instructors to search users and assign cards', () => {
    const permissions = getAppRolePermissions(Role.VOLUNTEER_INSTRUCTOR);

    expect(hasPermission(permissions, Permission.ADMIN_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.USERS_VIEW)).toBe(true);
    expect(hasPermission(permissions, Permission.CARDS_ASSIGN_NUMBER)).toBe(
      true
    );
    expect(hasPermission(permissions, Permission.CARDS_PRINT)).toBe(true);
    expect(hasPermission(permissions, Permission.EVENTS_ASSIGNED_MANAGE)).toBe(
      true
    );
    expect(hasPermission(permissions, Permission.EVENTS_MANAGE)).toBe(false);
    expect(hasPermission(permissions, Permission.CARDS_EXPIRE)).toBe(false);
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
