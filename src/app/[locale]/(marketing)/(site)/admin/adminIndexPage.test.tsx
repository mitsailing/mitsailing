import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

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

vi.mock('@/libs/I18nNavigation', () => ({
  Link: (props: {
    children: React.ReactNode;
    href: string;
    prefetch?: boolean;
  }) => <a href={props.href}>{props.children}</a>,
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
    permissions: [],
    roles: [],
    session: { session: { impersonatedBy: null }, user: { id: 'staff-1' } },
  });
});

describe('AdminIndexPage', () => {
  it('renders only dashboard links allowed by the current permissions', async () => {
    mocks.requireAdminAreaAccess.mockResolvedValue({
      permissions: [
        Permission.USERS_VIEW,
        Permission.EVENTS_MANAGE,
        Permission.PAYMENTS_VIEW,
        Permission.PAVILION_RESERVATIONS_MANAGE,
      ],
      roles: [],
      session: { session: { impersonatedBy: null }, user: { id: 'staff-1' } },
    });
    const { default: AdminIndexPage } = await import('./page');

    render(
      await AdminIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireAdminAreaAccess).toHaveBeenCalledWith('en');
    expect(screen.getByRole('link', { name: 'link_events' })).toHaveAttribute(
      'href',
      '/admin/events'
    );
    expect(
      screen.getByRole('link', { name: 'link_pavilion_reservations' })
    ).toHaveAttribute('href', '/admin/pavilion-reservations');
    expect(screen.getByRole('link', { name: 'link_payments' })).toHaveAttribute(
      'href',
      '/admin/payments'
    );
    expect(
      screen.getByRole('link', { name: 'hub_label_users' })
    ).toHaveAttribute('href', '/admin/users');
    expect(
      screen.queryByRole('link', { name: 'link_site_text' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'link_newsletter_subscribers' })
    ).not.toBeInTheDocument();
  });

  it('renders the events link for assigned event managers', async () => {
    mocks.requireAdminAreaAccess.mockResolvedValue({
      permissions: [Permission.EVENTS_ASSIGNED_MANAGE],
      roles: [],
      session: {
        session: { impersonatedBy: null },
        user: { id: 'instructor-1' },
      },
    });
    const { default: AdminIndexPage } = await import('./page');

    render(
      await AdminIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByRole('link', { name: 'link_events' })).toHaveAttribute(
      'href',
      '/admin/events'
    );
  });

  it('renders CMS, newsletter, and catalog links only when permissions allow them', async () => {
    mocks.requireAdminAreaAccess.mockResolvedValue({
      permissions: [
        Permission.CMS_VIEW,
        Permission.NEWSLETTER_MANAGE,
        Permission.FLEET_MANAGE,
      ],
      roles: [],
      session: { session: { impersonatedBy: null }, user: { id: 'admin-1' } },
    });
    const { default: AdminIndexPage } = await import('./page');

    render(
      await AdminIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.getByRole('link', { name: 'link_site_text' })
    ).toHaveAttribute('href', '/admin/site_text');
    expect(
      screen.getByRole('link', { name: 'link_newsletter_subscribers' })
    ).toHaveAttribute('href', '/admin/newsletter-subscribers');
    expect(
      screen.getByRole('link', { name: 'link_newsletter_lists' })
    ).toHaveAttribute('href', '/admin/newsletter-lists');
    expect(
      screen.getByRole('link', { name: 'link_newsletter_broadcasts' })
    ).toHaveAttribute('href', '/admin/newsletter-broadcasts');
    expect(
      screen.getByRole('link', { name: 'link_newsletter_templates' })
    ).toHaveAttribute('href', '/admin/newsletter-templates');
    expect(
      screen.getByRole('link', { name: 'link_email_templates' })
    ).toHaveAttribute('href', '/admin/email-templates');
    expect(
      screen.getByRole('link', { name: 'hub_label_fleet' })
    ).toHaveAttribute('href', '/admin/fleet');
    expect(
      screen.queryByRole('link', { name: 'hub_label_users' })
    ).not.toBeInTheDocument();
  });
});
