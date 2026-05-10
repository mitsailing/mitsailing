import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProfileSettingsChrome } from './ProfileSettingsChrome';

const chromeMocks = vi.hoisted(() => ({
  verifySession: vi.fn(),
}));

vi.mock('@/libs/auth/dal', () => ({
  verifySession: chromeMocks.verifySession,
}));

vi.mock('@/components/mit-sailing/SiteShell', () => ({
  SiteShell: (props: { children: React.ReactNode }) => (
    <div data-testid="site-shell">{props.children}</div>
  ),
}));

vi.mock('@/components/mit-sailing/SiteSidebarLayout', () => ({
  SiteSidebarLayout: (props: {
    children: React.ReactNode;
    density: string;
    sidebar: React.ReactNode;
    stretch?: boolean;
  }) => (
    <div data-testid="site-sidebar-layout">
      <aside>{props.sidebar}</aside>
      <main>{props.children}</main>
    </div>
  ),
}));

vi.mock('./ProfileSideNav', () => ({
  ProfileSideNav: () => <nav aria-label="Profile settings" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  chromeMocks.verifySession.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { email: 'sailor@example.com', id: 'user-1', role: 'user' },
  });
});

describe('ProfileSettingsChrome', () => {
  it('signed-in sailor sees profile settings shell', async () => {
    render(
      await ProfileSettingsChrome({
        children: <p>Account form</p>,
        locale: 'en',
        loginCallbackUrl: '/profile/account',
      })
    );

    expect(screen.getByTestId('site-shell')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'Profile settings' })
    ).toBeVisible();
    expect(screen.getByText('Account form')).toBeVisible();
  });
});
