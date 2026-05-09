import { setRequestLocale } from 'next-intl/server';
import type * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/components/mit-sailing/SiteShell', () => ({
  SiteShell: (props: { children: React.ReactNode }) => (
    <div data-testid="site-shell">{props.children}</div>
  ),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: vi.fn(),
}));

describe('marketing segment layouts', () => {
  it('home route group passes children through', async () => {
    const { default: HomeLayout } = await import('./(home)/layout');
    const node = HomeLayout({
      children: <span data-testid="home-inner">h</span>,
    });
    const html = renderToStaticMarkup(node);
    expect(html).toContain('data-testid="home-inner"');
    expect(html).not.toContain('data-testid="site-shell"');
  });

  it('site route group passes children through', async () => {
    const { default: SiteLayout } = await import('./(site)/layout');
    const node = SiteLayout({
      children: <span data-testid="site-inner">s</span>,
    });
    const html = renderToStaticMarkup(node);
    expect(html).toContain('data-testid="site-inner"');
    expect(html).not.toContain('data-testid="site-shell"');
  });

  it('wraps the marketing tree in the site shell', async () => {
    const { default: MarketingLayout } = await import('./layout');
    const tree = await MarketingLayout({
      children: <span data-testid="mkt">m</span>,
      params: Promise.resolve({ locale: 'en' }),
    });
    const html = renderToStaticMarkup(tree);
    expect(setRequestLocale).toHaveBeenCalledWith('en');
    expect(html).toContain('data-testid="site-shell"');
    expect(html).toContain('data-testid="mkt"');
  });
});
