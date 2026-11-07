import { describe, expect, it } from 'vitest';
import {
  adminUsersAccountTabPath,
  parseAdminUserAccountTab,
} from '@/libs/admin/users/adminUserAccountTab';

describe('adminUserAccountTab', () => {
  it('defaults unknown tab values to account', () => {
    expect(parseAdminUserAccountTab()).toBe('account');
    expect(parseAdminUserAccountTab('')).toBe('account');
    expect(parseAdminUserAccountTab('ratings')).toBe('account');
  });

  it('builds tabbed member account paths', () => {
    expect(adminUsersAccountTabPath('user-1')).toBe('/admin/users/user-1');
    expect(adminUsersAccountTabPath('user-1', 'admin')).toBe(
      '/admin/users/user-1?tab=admin'
    );
  });
});
