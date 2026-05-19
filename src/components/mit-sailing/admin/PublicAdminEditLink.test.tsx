import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';

const getSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/auth/dal', () => ({
  getSession: getSessionMock,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(
    () => (key: string) =>
      key === 'action_edit_public_page' ? 'Edit this page' : key
  ),
}));

afterEach(() => {
  getSessionMock.mockReset();
});

describe('PublicAdminEditLink', () => {
  it('renders an edit link for admins', async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { appRole: 'admin', id: 'admin-1', role: 'user' },
    });
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
      user: { appRole: 'user', id: 'user-1', role: 'admin' },
    });
    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });

  it('omits the edit link for anonymous sessions', async () => {
    getSessionMock.mockResolvedValue(null);

    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });

  it('omits the edit link for impersonating admins', async () => {
    getSessionMock.mockResolvedValue({
      session: { impersonatedBy: 'admin-1' },
      user: { appRole: 'admin', id: 'user-1', role: 'admin' },
    });
    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });

  it('omits the edit link for staff without cms edit permission', async () => {
    getSessionMock.mockResolvedValue({
      session: {},
      user: { appRole: 'dock_staff', id: 'staff-1', role: 'user' },
    });

    const view = render(
      await PublicAdminEditLink({
        href: '/admin/cms_pages/page-1/edit',
      })
    );

    expect(view.container).toBeEmptyDOMElement();
  });
});
