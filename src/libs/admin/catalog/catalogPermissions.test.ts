import { describe, expect, it } from 'vitest';
import { catalogPermissionForOperation } from '@/libs/admin/catalog/catalogPermissions';
import { Permission } from '@/libs/auth/permissions';

describe('catalogPermissionForOperation', () => {
  it.each([
    ['class_categories', Permission.CLASS_CATEGORIES_MANAGE],
    ['donation_funds', Permission.DONATION_FUNDS_MANAGE],
    ['event_categories', Permission.EVENT_CATEGORIES_MANAGE],
    ['fleet', Permission.FLEET_MANAGE],
    ['sailing_classes', Permission.SAILING_CLASSES_MANAGE],
    ['sailing_rating_rules', Permission.SAILING_RATING_RULES_MANAGE],
    ['sailing_ratings', Permission.SAILING_RATINGS_MANAGE],
    ['site_alerts', Permission.SITE_ALERTS_MANAGE],
  ])(
    'maps %s mutations to its resource permission',
    (resourceId, permission) => {
      expect(
        catalogPermissionForOperation({ operation: 'create', resourceId })
      ).toBe(permission);
      expect(
        catalogPermissionForOperation({ operation: 'update', resourceId })
      ).toBe(permission);
      expect(
        catalogPermissionForOperation({ operation: 'delete', resourceId })
      ).toBe(permission);
      expect(
        catalogPermissionForOperation({ operation: 'reorder', resourceId })
      ).toBe(permission);
      expect(
        catalogPermissionForOperation({ operation: 'restore', resourceId })
      ).toBe(permission);
      expect(
        catalogPermissionForOperation({ operation: 'view', resourceId })
      ).toBe(permission);
    }
  );

  it.each([
    ['cms_pages', Permission.CMS_VIEW, Permission.CMS_EDIT],
    ['cms_page_blocks', Permission.CMS_VIEW, Permission.CMS_EDIT],
    ['cms_menus', Permission.CMS_VIEW, Permission.CMS_EDIT],
    ['cms_menu_items', Permission.CMS_VIEW, Permission.CMS_EDIT],
  ])('maps %s operations to CMS permissions', (resourceId, view, edit) => {
    expect(
      catalogPermissionForOperation({ operation: 'view', resourceId })
    ).toBe(view);
    expect(
      catalogPermissionForOperation({ operation: 'delete', resourceId })
    ).toBe(Permission.CMS_DELETE);
    expect(
      catalogPermissionForOperation({ operation: 'create', resourceId })
    ).toBe(edit);
    expect(
      catalogPermissionForOperation({ operation: 'update', resourceId })
    ).toBe(edit);
    expect(
      catalogPermissionForOperation({ operation: 'restore', resourceId })
    ).toBe(edit);
  });

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
