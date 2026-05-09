import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const adminHeaderLinkVisibleFromSession = vi.fn();

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/auth/adminHeaderLink', () => ({
  adminHeaderLinkVisibleFromSession,
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('en'),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
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
    });

    it('hides admin link without session', async () => {
      const { shouldShowAdminLink } = await import('./SiteShell');

      expect(shouldShowAdminLink(null)).toBe(false);
      expect(adminHeaderLinkVisibleFromSession).toHaveBeenCalledWith({
        impersonatedBy: undefined,
        userId: undefined,
        userRole: undefined,
      });
    });
  });

  describe('when a session exists', () => {
    beforeEach(() => {
      getSession.mockResolvedValue({
        session: { impersonatedBy: undefined },
        user: { id: 'user-1', role: 'admin' },
      });
      adminHeaderLinkVisibleFromSession.mockReturnValue(true);
    });

    it('renders admin link when session-derived flags allow it', async () => {
      const { SiteShell, shouldShowAdminLink } = await import('./SiteShell');

      expect(
        shouldShowAdminLink({
          session: { impersonatedBy: undefined },
          user: { id: 'user-1', role: 'admin' },
        })
      ).toBe(true);

      const tree = await SiteShell({ children: null });
      const html = renderToStaticMarkup(tree);

      expect(adminHeaderLinkVisibleFromSession).toHaveBeenCalledWith({
        impersonatedBy: undefined,
        userId: 'user-1',
        userRole: 'admin',
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
