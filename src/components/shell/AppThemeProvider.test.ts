import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  AppThemeProvider,
  useAppTheme,
} from '@/components/shell/AppThemeProvider';
import type { AppColorScheme } from '@/lib/mit-sailing/themePreference';

function ThemeProbe() {
  const theme = useAppTheme();
  return React.createElement('span', null, theme.resolvedTheme);
}

function renderResolvedTheme(defaultTheme: AppColorScheme) {
  const props = {
    children: React.createElement(ThemeProbe),
    defaultTheme,
  } satisfies React.ComponentProps<typeof AppThemeProvider>;

  return renderToString(React.createElement(AppThemeProvider, props));
}

describe('AppThemeProvider', () => {
  it('initializes resolved theme from explicit dark preference', () => {
    expect(renderResolvedTheme('dark')).toContain('dark');
  });

  it('initializes resolved theme from non-dark preferences without window', () => {
    expect(renderResolvedTheme('light')).toContain('light');
    expect(renderResolvedTheme('system')).toContain('light');
  });
});
