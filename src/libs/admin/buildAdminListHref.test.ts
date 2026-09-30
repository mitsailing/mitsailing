import { describe, expect, it } from 'vitest';
import {
  buildAdminListHref,
  buildAdminListHrefWithoutParam,
} from './buildAdminListHref';

describe('buildAdminListHref', () => {
  it('merges updates and omits default facet values', () => {
    expect(
      buildAdminListHref({
        omitWhenDefault: { emailStatus: 'all', scope: 'my' },
        params: { emailStatus: 'all', page: '2', scope: 'my' },
        pathname: '/admin/users',
        updates: { emailStatus: 'bounced' },
      })
    ).toBe('/admin/users?emailStatus=bounced');
  });

  it('drops page when filters change', () => {
    expect(
      buildAdminListHref({
        params: { page: '3', q: 'ada' },
        pathname: '/admin/users',
        updates: { q: 'grace' },
      })
    ).toBe('/admin/users?q=grace');
  });

  it('keeps page when page is explicitly updated', () => {
    expect(
      buildAdminListHref({
        params: { emailStatus: 'bounced', page: '1' },
        pathname: '/admin/users',
        updates: { page: '2' },
      })
    ).toBe('/admin/users?emailStatus=bounced&page=2');
  });
});

describe('buildAdminListHrefWithoutParam', () => {
  it('removes one param and resets page', () => {
    expect(
      buildAdminListHrefWithoutParam({
        omitWhenDefault: { emailStatus: 'all' },
        param: 'emailStatus',
        params: { emailStatus: 'bounced', page: '2', q: 'ada' },
        pathname: '/admin/users',
      })
    ).toBe('/admin/users?q=ada');
  });
});
