import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_SITE_NAV_ITEMS } from '@/libs/admin/adminNavigation';

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  requireAdminAreaAccess: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/admin/AdminSideNav', () => ({
  AdminSideNav: (props: { items: { href: string }[] }) => (
    <nav data-testid="admin-nav">
      {props.items.map((item) => (
        <a href={item.href} key={item.href}>
          {item.href}
        </a>
      ))}
    </nav>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }) => (
    <main>{props.children}</main>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }) => (
    <section>{props.children}</section>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSidebarLayout', () => ({
  SiteSidebarLayout: (props: {
    children: React.ReactNode;
    sidebar: React.ReactNode;
  }) => (
    <div>
      {props.sidebar}
      {props.children}
    </div>
  ),
}));

vi.mock('@/libs/admin/adminAreaAccess', () => ({
  requireAdminAreaAccess: mocks.requireAdminAreaAccess,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.getTranslations.mockClear();
  mocks.requireAdminAreaAccess.mockReset();
  mocks.setRequestLocale.mockClear();

  mocks.requireAdminAreaAccess.mockResolvedValue({
    navItems: ADMIN_SITE_NAV_ITEMS,
    roles: [],
    session: { session: { impersonatedBy: null }, user: { id: 'staff-1' } },
  });
});

describe('AdminSectionLayout', () => {
  it('requires admin area access for every child route', async () => {
    const { default: AdminSectionLayout } = await import('./layout');

    render(
      await AdminSectionLayout({
        children: <div>Admin child</div>,
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireAdminAreaAccess).toHaveBeenCalledWith('en');
    expect(screen.getByText('Admin child')).toBeInTheDocument();
    expect(screen.getByTestId('admin-nav')).toHaveTextContent('/admin');
    expect(screen.getByTestId('admin-nav')).toHaveTextContent('/admin/users');
  });
});
