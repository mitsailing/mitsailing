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
    <div
      data-density={props.density}
      data-stretch={String(props.stretch)}
      data-testid="site-sidebar-layout"
    >
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
    session: {},
    user: { id: 'user-1' },
  });
});

describe('ProfileSettingsChrome', () => {
  it('signed-in sailor sees profile settings shell', async () => {
    render(
      await ProfileSettingsChrome({
        children: <p>Account form</p>,
        locale: 'en',
        loginCallbackUrl: '/profile/account/',
      })
    );

    expect(chromeMocks.verifySession).toHaveBeenCalledWith(
      'en',
      '/profile/account/'
    );
    expect(screen.getByTestId('site-shell')).toBeInTheDocument();
    expect(screen.getByTestId('site-sidebar-layout')).toHaveAttribute(
      'data-density',
      'comfortable'
    );
    expect(screen.getByTestId('site-sidebar-layout')).toHaveAttribute(
      'data-stretch',
      'true'
    );
    expect(
      screen.getByRole('navigation', { name: 'Profile settings' })
    ).toBeVisible();
    expect(screen.getByText('Account form')).toBeVisible();
  });
});
