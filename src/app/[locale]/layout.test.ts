import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const layoutMocks = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error('not_found');
  }),
  hasLocale: vi.fn((_locales: readonly string[], _locale: string) => true),
}));

const themeHooks = vi.hoisted(() => ({
  getDefaultThemeForRootLayout: vi.fn(
    (): 'system' | 'light' | 'dark' => 'system'
  ),
}));

vi.mock('next/navigation', () => ({
  notFound: layoutMocks.notFound,
}));

vi.mock('next-intl', () => ({
  hasLocale: (locales: readonly string[], locale: string): boolean =>
    Boolean(layoutMocks.hasLocale(locales, locale)),
  NextIntlClientProvider: (props: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'intl' }, props.children),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

vi.mock('@/libs/theme-layout', () => ({
  getDefaultThemeForRootLayout: themeHooks.getDefaultThemeForRootLayout,
}));

vi.mock('@/libs/Env', () => ({
  Env: { NEXT_PUBLIC_APP_URL: 'http://localhost:3008' },
}));

vi.mock('@/components/shell/AppThemeProvider', () => ({
  AppThemeProvider: (props: { children: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'theme' }, props.children),
}));

vi.mock('@/components/shell/SentryUserSync', () => ({
  SentryUserSync: () => null,
}));

vi.mock('@/utils/AppConfig', () => ({
  AppConfig: {
    name: 'Test',
    i18n: {
      defaultLocale: 'en',
      localePrefix: 'as-needed',
      locales: ['en'],
    },
  },
}));

vi.mock('@/styles/global.css', () => ({}));

describe('RootLayout', () => {
  beforeEach(() => {
    layoutMocks.hasLocale.mockReset();
    layoutMocks.notFound.mockClear();
    layoutMocks.hasLocale.mockReturnValue(true);
    themeHooks.getDefaultThemeForRootLayout.mockReset();
    themeHooks.getDefaultThemeForRootLayout.mockResolvedValue('system');
  });

  it('calls notFound for unsupported locales', async () => {
    layoutMocks.hasLocale.mockReturnValue(false);
    const { default: RootLayout } = await import('./layout');

    await expect(
      RootLayout({
        children: React.createElement('span', null, 'child'),
        params: Promise.resolve({ locale: 'xx' }),
      })
    ).rejects.toThrow('not_found');

    expect(layoutMocks.notFound).toHaveBeenCalled();
  });

  it('renders the html shell for a supported locale', async () => {
    const { default: RootLayout } = await import('./layout');

    const tree = await RootLayout({
      children: React.createElement(
        'span',
        { 'data-testid': 'child' },
        'inner'
      ),
      params: Promise.resolve({ locale: 'en' }),
    });

    const html = renderToStaticMarkup(tree);
    expect(html).toContain('data-testid="child"');
    expect(html).toContain('lang="en"');
    expect(html).toContain('theme-boot');
    expect(layoutMocks.notFound).not.toHaveBeenCalled();
  });

  it('sets the dark class on html when the default theme is dark', async () => {
    themeHooks.getDefaultThemeForRootLayout.mockResolvedValue('dark');
    const { default: RootLayout } = await import('./layout');

    const tree = await RootLayout({
      children: React.createElement('span', null, 'child'),
      params: Promise.resolve({ locale: 'en' }),
    });

    const html = renderToStaticMarkup(tree);
    expect(html).toContain('class="dark"');
  });
});
