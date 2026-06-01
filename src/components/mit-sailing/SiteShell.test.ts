import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const adminHeaderLinkVisibleFromSession = vi.fn();
const env = vi.hoisted(() => ({
  STAGING_BANNER: 'no' as 'no' | 'yes',
}));

vi.mock('@/libs/Env', () => ({
  Env: env,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/auth/adminHeaderLink', () => ({
  adminHeaderLinkVisibleFromSession,
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('en'),
  getTranslations: vi.fn().mockResolvedValue(
    Object.assign((key: string) => key, {
      rich: (
        key: string,
        values: { link: (chunks: React.ReactNode) => React.ReactNode }
      ) => {
        if (key !== 'staging_banner') {
          return key;
        }
        return React.createElement(
          React.Fragment,
          null,
          'Staging website. Visit the live MIT Sailing site at ',
          values.link('https://sailing.mit.edu'),
          '.'
        );
      },
    })
  ),
}));

vi.mock('@/components/auth/ImpersonationBanner', () => ({
  ImpersonationBanner: () =>
    React.createElement('div', { 'data-testid': 'impersonation-banner' }),
}));

vi.mock('@/components/mit-sailing/site/WeatherConditionsBar', () => ({
  WeatherConditionsBar: () =>
    React.createElement('div', { 'data-testid': 'weather-bar' }),
  WeatherConditionsBarSkeleton: () =>
    React.createElement('div', { 'data-testid': 'weather-skeleton' }),
}));

vi.mock('@/components/mit-sailing/SiteShellAlertsTopBar', () => ({
  SiteShellAlertsTopBar: () =>
    React.createElement('div', { 'data-testid': 'alerts-top' }),
}));

vi.mock('@/components/mit-sailing/SiteShellHeaderNav', () => ({
  SiteShellHeaderNav: (props: { initialShowAdminLink?: boolean }) =>
    React.createElement(
      'div',
      { 'data-testid': 'header-nav' },
      props.initialShowAdminLink
        ? React.createElement('a', { href: '/admin' }, 'Admin')
        : null
    ),
}));

vi.mock('@/components/mit-sailing/site/SiteFooter', () => ({
  SiteFooter: () =>
    React.createElement('footer', { 'data-testid': 'site-footer' }),
}));

vi.mock('@/components/mit-sailing/site/SiteHeader', () => ({
  SiteHeader: (props: { initialShowAdminLink?: boolean }) =>
    React.createElement(
      'header',
      { 'data-testid': 'site-header' },
      props.initialShowAdminLink
        ? React.createElement('a', { href: '/admin' }, 'Admin')
        : null
    ),
}));

describe('SiteShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.STAGING_BANNER = 'no';
    getSession.mockResolvedValue(null);
    adminHeaderLinkVisibleFromSession.mockReturnValue(false);
  });

  describe('when there is no session', () => {
    it('renders page body and footer chrome', async () => {
      const { SiteShell } = await import('./SiteShell');

      const tree = await SiteShell({
        children: React.createElement(
          'span',
          { 'data-testid': 'page-body' },
          'Page'
        ),
      });
      const html = renderToStaticMarkup(tree);

      expect(html).toContain('data-testid="page-body"');
      expect(html).toContain('data-testid="site-footer"');
      expect(html).not.toContain('Staging website');
    });

    it('renders staging banner when configured', async () => {
      env.STAGING_BANNER = 'yes';
      const { SiteShell } = await import('./SiteShell');

      const tree = await SiteShell({ children: null });
      const html = renderToStaticMarkup(tree);

      expect(html).toContain('Staging website');
      expect(html).toContain('href="https://sailing.mit.edu"');
      expect(html).toContain('https://sailing.mit.edu');
    });

    it('hides admin link without session', async () => {
      const { shouldShowAdminLink } = await import('./SiteShell');

      expect(shouldShowAdminLink(null)).toBe(false);
      expect(adminHeaderLinkVisibleFromSession).toHaveBeenCalledWith({
        impersonatedBy: undefined,
        userAppRole: undefined,
        userBanned: undefined,
        userEmailVerified: undefined,
        userId: undefined,
      });
    });
  });

  describe('when a session exists', () => {
    beforeEach(() => {
      getSession.mockResolvedValue({
        session: { impersonatedBy: undefined },
        user: {
          appRole: 'admin',
          banned: false,
          emailVerified: true,
          id: 'user-1',
          role: 'user',
        },
      });
      adminHeaderLinkVisibleFromSession.mockReturnValue(true);
    });

    it('renders admin link when session-derived flags allow it', async () => {
      const { SiteShell, shouldShowAdminLink } = await import('./SiteShell');

      expect(
        shouldShowAdminLink({
          session: { impersonatedBy: undefined },
          user: {
            appRole: 'admin',
            banned: false,
            emailVerified: true,
            id: 'user-1',
          },
        })
      ).toBe(true);

      const tree = await SiteShell({ children: null });
      const html = renderToStaticMarkup(tree);

      expect(adminHeaderLinkVisibleFromSession).toHaveBeenCalledWith({
        impersonatedBy: undefined,
        userAppRole: 'admin',
        userBanned: false,
        userEmailVerified: true,
        userId: 'user-1',
      });
      expect(html).toContain('Admin');
    });

    it('hides admin link when session-derived flags deny it', async () => {
      const { SiteShell } = await import('./SiteShell');

      adminHeaderLinkVisibleFromSession.mockReturnValue(false);
      const hiddenTree = await SiteShell({ children: null });
      expect(renderToStaticMarkup(hiddenTree)).not.toContain('Admin');
    });
  });
});
