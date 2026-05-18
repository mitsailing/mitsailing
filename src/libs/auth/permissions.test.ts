import { describe, expect, it } from 'vitest';
import {
  AuthAction,
  AuthSubject,
  createAuthAbility,
  createEventAbilitySubject,
  createEventRegistrationAbilitySubject,
  Permission,
  PERMISSION_DEFINITIONS,
  normalizeRolePermissionGrant,
  permissionGrantsForSeed,
} from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

describe('createAuthAbility', () => {
  it('maps role permission rows into CASL permission actions', () => {
    const ability = createAuthAbility({
      grants: [
        {
          permissionKey: Permission.USERS_VIEW,
          roleKey: Role.VOLUNTEER_INSTRUCTOR,
        },
      ],
      role: Role.VOLUNTEER_INSTRUCTOR,
    });

    expect(ability.can(Permission.USERS_VIEW, AuthSubject.PERMISSION)).toBe(
      true
    );
    expect(ability.can(Permission.CMS_EDIT, AuthSubject.PERMISSION)).toBe(
      false
    );
  });

  it('grants site admins every permission action', () => {
    const ability = createAuthAbility({
      grants: [],
      role: Role.ADMIN,
    });

    expect(
      ability.can(Permission.ROLES_MANAGE_PERMISSIONS, AuthSubject.PERMISSION)
    ).toBe(true);
  });

  it('applies grants from every assigned role', () => {
    const ability = createAuthAbility({
      grants: [
        {
          permissionKey: Permission.CMS_EDIT,
          roleKey: Role.DOCK_STAFF,
        },
      ],
      roles: [Role.VOLUNTEER, Role.DOCK_STAFF],
    });

    expect(ability.can(Permission.CMS_EDIT, AuthSubject.PERMISSION)).toBe(true);
  });

  it('limits registration edits to the owning user', () => {
    const ability = createAuthAbility({
      grants: [],
      role: Role.USER,
      userId: 'user-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventRegistrationAbilitySubject({ userId: 'user-1' })
      )
    ).toBe(true);
    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventRegistrationAbilitySubject({ userId: 'user-2' })
      )
    ).toBe(false);
  });

  it('grants dock staff global event edit access', () => {
    const ability = createAuthAbility({
      grants: [
        {
          permissionKey: Permission.EVENTS_MANAGE,
          roleKey: Role.DOCK_STAFF,
        },
      ],
      role: Role.DOCK_STAFF,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [],
          createdByUserId: 'user-2',
        })
      )
    ).toBe(true);
  });

  it('grants dock masters global event edit access', () => {
    const ability = createAuthAbility({
      grants: [
        {
          permissionKey: Permission.EVENTS_MANAGE,
          roleKey: Role.DOCK_MASTER,
        },
      ],
      role: Role.DOCK_MASTER,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [],
          createdByUserId: 'user-2',
        })
      )
    ).toBe(true);
  });

  it('limits volunteer instructor event edits to assigned admins with event creation', () => {
    const ability = createAuthAbility({
      grants: [
        {
          permissionKey: Permission.EVENTS_CREATE,
          roleKey: Role.VOLUNTEER_INSTRUCTOR,
        },
      ],
      role: Role.VOLUNTEER_INSTRUCTOR,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [{ adminUserId: 'admin-1' }],
          createdByUserId: 'user-2',
        })
      )
    ).toBe(true);
    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [],
          createdByUserId: 'admin-1',
        })
      )
    ).toBe(false);
  });
});

describe('permissionGrantsForSeed', () => {
  it('includes conservative launch defaults', () => {
    const grants = permissionGrantsForSeed();

    expect(grants).toContainEqual({
      permissionKey: Permission.CARDS_APPROVE,
      roleKey: Role.DOCK_STAFF,
    });
    expect(grants).toContainEqual({
      permissionKey: Permission.ADMIN_VIEW,
      roleKey: Role.DOCK_STAFF,
    });
    expect(grants).toContainEqual({
      permissionKey: Permission.EVENTS_MANAGE,
      roleKey: Role.DOCK_STAFF,
    });
    expect(grants).toContainEqual({
      permissionKey: Permission.EVENTS_MANAGE,
      roleKey: Role.DOCK_MASTER,
    });
    expect(grants).toContainEqual({
      permissionKey: Permission.WAREHOUSE_SYNC,
      roleKey: Role.DOCK_MASTER,
    });
  });

  it('grants volunteer instructors event creation by default', () => {
    const grants = permissionGrantsForSeed();

    expect(grants).toContainEqual({
      permissionKey: Permission.EVENTS_CREATE,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    });
  });

  it('does not seed grants for regular users or hard-coded admins', () => {
    const grants = permissionGrantsForSeed();

    expect(grants).not.toContainEqual(
      expect.objectContaining({ roleKey: Role.USER })
    );
    expect(grants).not.toContainEqual(
      expect.objectContaining({ roleKey: Role.ADMIN })
    );
  });
});

describe('PERMISSION_DEFINITIONS', () => {
  it('keeps permission labels and groups as translation keys', () => {
    expect(PERMISSION_DEFINITIONS).toContainEqual({
      groupKey: 'group_cms',
      key: Permission.CMS_EDIT,
      labelKey: 'permission_cms_edit',
    });
  });
});

describe('normalizeRolePermissionGrant', () => {
  it('rejects grants for regular users and hard-coded admins', () => {
    expect(
      normalizeRolePermissionGrant({
        permissionKey: Permission.ADMIN_VIEW,
        roleKey: Role.USER,
      })
    ).toBeNull();
    expect(
      normalizeRolePermissionGrant({
        permissionKey: Permission.ADMIN_VIEW,
        roleKey: Role.ADMIN,
      })
    ).toBeNull();
  });

  it('accepts code-defined permissions for grantable staff roles', () => {
    expect(
      normalizeRolePermissionGrant({
        permissionKey: Permission.USERS_EDIT,
        roleKey: Role.DOCK_STAFF,
      })
    ).toEqual({
      permissionKey: Permission.USERS_EDIT,
      roleKey: Role.DOCK_STAFF,
    });
  });

  it('accepts event creation as a grantable permission', () => {
    expect(
      normalizeRolePermissionGrant({
        permissionKey: Permission.EVENTS_CREATE,
        roleKey: Role.VOLUNTEER_INSTRUCTOR,
      })
    ).toEqual({
      permissionKey: Permission.EVENTS_CREATE,
      roleKey: Role.VOLUNTEER_INSTRUCTOR,
    });
  });
});
