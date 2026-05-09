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
  ImpersonationBanner: () => <div data-testid="impersonation-banner" />,
}));

vi.mock('@/components/mit-sailing/site/WeatherConditionsBar', () => ({
  WeatherConditionsBar: () => <div data-testid="weather-bar" />,
  WeatherConditionsBarSkeleton: () => <div data-testid="weather-skeleton" />,
}));

vi.mock('@/components/mit-sailing/SiteShellAlertsTopBar', () => ({
  SiteShellAlertsTopBar: () => <div data-testid="alerts-top" />,
}));

vi.mock('@/components/mit-sailing/SiteShellHeaderNav', () => ({
  SiteShellHeaderNav: () => <div data-testid="header-nav" />,
}));

vi.mock('@/components/mit-sailing/site/SiteFooter', () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));

describe('SiteShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue(null);
    adminHeaderLinkVisibleFromSession.mockReturnValue(false);
  });

  it('renders chrome markup with main content scope', async () => {
    const { SiteShell } = await import('./SiteShell');

    const tree = await SiteShell({
      children: <span data-testid="page-body">Page</span>,
    });
    const html = renderToStaticMarkup(tree);

    expect(html).toContain('id="site-shell-inert-scope"');
    expect(html).toContain('data-testid="page-body"');
    expect(html).toContain('data-testid="site-footer"');
  });

  it('passes session-derived flags into header nav props', async () => {
    getSession.mockResolvedValue({
      session: { impersonatedBy: undefined },
      user: { id: 'user-1', role: 'admin' },
    });
    adminHeaderLinkVisibleFromSession.mockReturnValue(true);

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
