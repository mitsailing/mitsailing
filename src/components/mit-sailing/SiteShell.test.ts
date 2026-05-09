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
  getLocale: vi.fn(async () => {
    await Promise.resolve();
    return 'en';
  }),
  getTranslations: vi.fn(async (_namespace: string) => {
    await Promise.resolve();
    return (key: string) => key;
  }),
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
  SiteShellHeaderNav: () =>
    React.createElement('div', { 'data-testid': 'header-nav' }),
}));

vi.mock('@/components/mit-sailing/site/SiteFooter', () => ({
  SiteFooter: () =>
    React.createElement('footer', { 'data-testid': 'site-footer' }),
}));

vi.mock('@/components/mit-sailing/site/SiteHeader', () => ({
  SiteHeader: () =>
    React.createElement('header', { 'data-testid': 'site-header' }),
}));

describe('SiteShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
    adminHeaderLinkVisibleFromSession.mockReturnValue(false);
  });

  describe('when there is no session', () => {
    it('renders chrome markup with main content scope', async () => {
      const { SiteShell } = await import('./SiteShell');

      const tree = await SiteShell({
        children: React.createElement(
          'span',
          { 'data-testid': 'page-body' },
          'Page'
        ),
      });
      const html = renderToStaticMarkup(tree);

      expect(html).toContain('id="site-shell-inert-scope"');
      expect(html).toContain('data-testid="page-body"');
      expect(html).toContain('data-testid="site-footer"');
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

    it('passes session-derived flags into header nav props', async () => {
      const { SiteShell } = await import('./SiteShell');

      const tree = await SiteShell({ children: null });
      renderToStaticMarkup(tree);

      expect(adminHeaderLinkVisibleFromSession).toHaveBeenCalledWith({
        impersonatedBy: undefined,
        userId: 'user-1',
        userRole: 'admin',
      });
    });
  });
});
