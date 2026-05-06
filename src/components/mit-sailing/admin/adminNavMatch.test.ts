import { describe, expect, it } from 'vitest';
import { isAdminNavItemActive } from '@/components/mit-sailing/admin/adminNavMatch';

describe('isAdminNavItemActive', () => {
  it('matches exact admin paths only', () => {
    expect(
      isAdminNavItemActive({
        href: '/admin/',
        match: 'exact',
        pathname: '/admin/',
      })
    ).toBe(true);
    expect(
      isAdminNavItemActive({
        href: '/admin/',
        match: 'exact',
        pathname: '/admin/events/',
      })
    ).toBe(false);
  });

  it('matches prefixed admin paths', () => {
    expect(
      isAdminNavItemActive({
        href: '/admin/events/',
        match: 'prefix',
        pathname: '/admin/events/new/',
      })
    ).toBe(true);
  });
});
