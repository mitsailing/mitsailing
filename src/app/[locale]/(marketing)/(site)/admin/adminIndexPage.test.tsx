import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => ({
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  requireAdminAreaAccess: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/admin/adminAreaAccess', () => ({
  requireAdminAreaAccess: mocks.requireAdminAreaAccess,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.getTranslations.mockClear();
  mocks.requireAdminAreaAccess.mockReset();
  mocks.setRequestLocale.mockClear();
  mocks.redirect.mockClear();
});

describe('AdminIndexPage', () => {
  it('redirects to the first permitted admin section', async () => {
    mocks.requireAdminAreaAccess.mockResolvedValue({
      navItems: [
        {
          href: '/admin',
          labelKey: 'nav_admin',
          match: 'exact',
          permissions: [],
        },
        {
          href: '/admin/users',
          labelKey: 'nav_users',
          match: 'prefix',
          permissions: [],
        },
        {
          href: '/admin/events',
          labelKey: 'nav_events',
          match: 'prefix',
          permissions: [],
        },
      ],
      permissions: [Permission.USERS_VIEW, Permission.EVENTS_MANAGE],
      roles: [],
      session: { session: { impersonatedBy: null }, user: { id: 'staff-1' } },
    });
    const { default: AdminIndexPage } = await import('./page');

    await expect(
      AdminIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('REDIRECT:/admin/users');

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireAdminAreaAccess).toHaveBeenCalledWith('en');
    expect(mocks.redirect).toHaveBeenCalledWith('/admin/users');
  });

  it('redirects event-only managers to events', async () => {
    mocks.requireAdminAreaAccess.mockResolvedValue({
      navItems: [
        {
          href: '/admin',
          labelKey: 'nav_admin',
          match: 'exact',
          permissions: [],
        },
        {
          href: '/admin/events',
          labelKey: 'nav_events',
          match: 'prefix',
          permissions: [],
        },
      ],
      permissions: [Permission.EVENTS_ASSIGNED_MANAGE],
      roles: [],
      session: {
        session: { impersonatedBy: null },
        user: { id: 'instructor-1' },
      },
    });
    const { default: AdminIndexPage } = await import('./page');

    await expect(
      AdminIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    ).rejects.toThrow('REDIRECT:/admin/events');

    expect(mocks.redirect).toHaveBeenCalledWith('/admin/events');
  });
});
