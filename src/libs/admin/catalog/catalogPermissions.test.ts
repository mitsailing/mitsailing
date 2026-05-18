import { describe, expect, it } from 'vitest';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { Permission } from '@/libs/auth/permissions';

describe('catalogPermissionForOperation', () => {
  it('allows admin view fallback only for unmapped read operations', () => {
    const resourceId = 'new_catalog_resource';

    expect(
      catalogPermissionForOperation({ operation: 'view', resourceId })
    ).toBe(Permission.ADMIN_VIEW);
    const updatePermission = () => {
      catalogPermissionForOperation({ operation: 'update', resourceId });
    };

    expect(updatePermission).toThrow('Missing catalog permission mapping');
  });
});
