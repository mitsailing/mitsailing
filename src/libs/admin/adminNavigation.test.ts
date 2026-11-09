import { describe, expect, it } from 'vitest';
import {
  adminLandingPath,
  adminNavItemsForPermissions,
} from '@/libs/admin/adminNavigation';
import { Permission } from '@/libs/auth/permissions';

describe('adminNavigation', () => {
  describe('adminLandingPath', () => {
    it('skips the admin index and returns the first section', () => {
      const navItems = adminNavItemsForPermissions([
        Permission.ADMIN_VIEW,
        Permission.USERS_VIEW,
        Permission.EVENTS_MANAGE,
      ]);
      expect(adminLandingPath(navItems)).toBe('/admin/users');
    });

    it('returns events when users is not permitted', () => {
      const navItems = adminNavItemsForPermissions([
        Permission.ADMIN_VIEW,
        Permission.EVENTS_ASSIGNED_MANAGE,
      ]);
      expect(adminLandingPath(navItems)).toBe('/admin/events');
    });
  });

  describe('adminNavItemsForPermissions', () => {
    it('shows cms when cms view is permitted', () => {
      expect(
        adminNavItemsForPermissions([Permission.NEWS_MANAGE]).map(
          (item) => item.href
        )
      ).not.toContain('/cms');

      expect(
        adminNavItemsForPermissions([
          Permission.NEWS_MANAGE,
          Permission.CMS_VIEW,
        ]).map((item) => item.href)
      ).toContain('/cms');
    });
  });
});
