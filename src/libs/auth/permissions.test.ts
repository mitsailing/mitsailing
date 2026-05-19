import { describe, expect, it } from 'vitest';
import {
  AuthAction,
  AuthSubject,
  createAuthAbility,
  createEventAbilitySubject,
  createEventRegistrationAbilitySubject,
  Permission,
  PERMISSION_DEFINITIONS,
} from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

describe('createAuthAbility', () => {
  it('maps app role permissions into CASL permission actions', () => {
    const ability = createAuthAbility({
      role: Role.DOCK_STAFF,
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
      role: Role.ADMIN,
    });

    expect(ability.can(Permission.USERS_DELETE, AuthSubject.PERMISSION)).toBe(
      true
    );
  });

  it('limits registration edits to the owning user', () => {
    const ability = createAuthAbility({
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
      role: Role.DOCK_STAFF,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [],
        })
      )
    ).toBe(true);
  });

  it('grants dock masters global event edit access', () => {
    const ability = createAuthAbility({
      role: Role.DOCK_MASTER,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [],
        })
      )
    ).toBe(true);
  });

  it('grants assigned volunteer instructor event edit access', () => {
    const ability = createAuthAbility({
      role: Role.VOLUNTEER_INSTRUCTOR,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [{ adminUserId: 'admin-1' }],
        })
      )
    ).toBe(true);
  });

  it('denies unassigned volunteer instructor event edit access', () => {
    const ability = createAuthAbility({
      role: Role.VOLUNTEER_INSTRUCTOR,
      userId: 'admin-1',
    });

    expect(
      ability.can(
        AuthAction.UPDATE,
        createEventAbilitySubject({
          admins: [{ adminUserId: 'admin-2' }],
        })
      )
    ).toBe(false);
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
