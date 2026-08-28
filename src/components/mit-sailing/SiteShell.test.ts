import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const adminHeaderLinkVisibleFromSession = vi.fn();
const env = vi.hoisted(() => ({
  STAGING_BANNER: 'no' as 'no' | 'yes',
}));
const getOnboardingTaskHrefForUser = vi.fn();

vi.mock('@/libs/Env', () => ({
  Env: env,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/auth/adminHeaderLink', () => ({
  adminHeaderLinkVisibleFromSession,
}));

vi.mock('@/libs/mit-sailing/onboardingTask', () => ({
  getOnboardingTaskHrefForUser,
}));

vi.mock('next-intl/server', () => ({
  getLocale: vi.fn().mockResolvedValue('en'),
  getTranslations: vi.fn().mockResolvedValue(
    Object.assign((key: string) => key, {
      rich: (
        key: string,
        values: { link: (chunks: React.ReactNode) => React.ReactNode }
      ) => {
        if (key !== 'preview_banner') {
          return key;
        }
        return React.createElement(
          React.Fragment,
          null,
          'This is not the official MIT Sailing site. Do not create accounts, register for events, use the calendar, or reserve the pavilion here — that data is dummy and is not processed. Use ',
          values.link('sailing.mit.edu'),
          ' for the real site.'
        );
      },
    })
  ),
}));

vi.mock('@/components/auth/ImpersonationBanner', () => ({
  ImpersonationBanner: () =>
    React.createElement('div', { 'data-testid': 'impersonation-banner' }),
}));

vi.mock('@/components/mit-sailing/site/SitePreviewBanner', () => ({
  SitePreviewBanner: () =>
    env.STAGING_BANNER === 'yes'
      ? React.createElement(
          'aside',
          { 'data-testid': 'preview-banner' },
          'This is not the official MIT Sailing site. ',
          React.createElement(
            'a',
            { href: 'https://sailing.mit.edu' },
            'sailing.mit.edu'
          ),
          ' preview_banner_tag'
        )
      : null,
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
  SiteShellHeaderNav: (props: {
    initialShowAdminLink?: boolean;
    userId?: string;
  }) =>
    React.createElement(
      'div',
      { 'data-testid': 'header-nav' },
      props.userId
        ? React.createElement('span', { 'data-user-id': props.userId }, 'User')
        : null,
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
  SiteHeader: (props: {
    initialShowAdminLink?: boolean;
    onboardingTaskHref?: string | null;
  }) =>
    React.createElement(
      'header',
      { 'data-testid': 'site-header' },
      props.onboardingTaskHref
        ? React.createElement('a', { href: props.onboardingTaskHref }, 'Task')
        : null,
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
    getOnboardingTaskHrefForUser.mockResolvedValue(null);
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
      expect(html).not.toContain('not the official MIT Sailing site');
    });

    it('renders preview banner when configured', async () => {
      env.STAGING_BANNER = 'yes';
      const { SiteShell } = await import('./SiteShell');

      const tree = await SiteShell({ children: null });
      const html = renderToStaticMarkup(tree);

      expect(html).toContain('not the official MIT Sailing site');
      expect(html).toContain('href="https://sailing.mit.edu"');
      expect(html).toContain('preview_banner_tag');
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

    it('passes the user id to the streamed header without blocking on onboarding task lookup', async () => {
      const { SiteShell } = await import('./SiteShell');

      getOnboardingTaskHrefForUser.mockResolvedValue('/onboarding');
      const tree = await SiteShell({ children: null });
      const html = renderToStaticMarkup(tree);

      expect(getOnboardingTaskHrefForUser).not.toHaveBeenCalled();
      expect(html).toContain('data-user-id="user-1"');
    });
  });
});
