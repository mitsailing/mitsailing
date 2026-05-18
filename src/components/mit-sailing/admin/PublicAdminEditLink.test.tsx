import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';

const getSessionMock = vi.hoisted(() => vi.fn());
const listRolePermissionGrantsMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth/dal', () => ({
  getSession: getSessionMock,
}));

vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  listRolePermissionGrants: listRolePermissionGrantsMock,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    () => (key: string) =>
      key === 'action_edit_public_page' ? 'Edit this page' : key
  ),
}));

afterEach(() => {
  getSessionMock.mockReset();
  listRolePermissionGrantsMock.mockReset();
});

describe('PublicAdminEditLink', () => {
  it('renders an edit link for admins', async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { id: 'admin-1', role: 'admin' },
    });
    listRolePermissionGrantsMock.mockResolvedValue([]);

    render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(
      screen.getByRole('link', { name: /edit this page/i })
    ).toHaveAttribute('href', '/admin/cms_pages/page-1/edit');
  });

  it('omits the edit link for non-admins', async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { id: 'user-1', role: 'user' },
    });
    listRolePermissionGrantsMock.mockResolvedValue([]);

    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });

  it('skips grant lookup for anonymous sessions', async () => {
    getSessionMock.mockResolvedValue(null);

    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
    expect(listRolePermissionGrantsMock).not.toHaveBeenCalled();
  });

  it('omits the edit link for impersonating admins', async () => {
    getSessionMock.mockResolvedValue({
      session: { impersonatedBy: 'admin-1' },
      user: { id: 'user-1', role: 'admin' },
    });
    listRolePermissionGrantsMock.mockResolvedValue([]);

    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });

  it('renders an edit link for staff with cms edit permission', async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { id: 'staff-1', role: 'volunteer_instructor' },
    });
    listRolePermissionGrantsMock.mockResolvedValue([
      { roleKey: 'volunteer_instructor', permissionKey: 'cms.edit' },
    ]);

    render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(
      screen.getByRole('link', { name: /edit this page/i })
    ).toHaveAttribute('href', '/admin/cms_pages/page-1/edit');
  });
});
