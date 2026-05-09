import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from '@/components/shell/AppThemeProvider';

describe('AppThemeProvider', () => {
  it('initializes resolved theme from light preference', () => {
    expect(resolveInitialTheme('light')).toBe('light');
  });

  it('initializes resolved theme for system preference without window', () => {
    expect(resolveInitialTheme('system', false)).toBe('light');
  });

  it('initializes resolved theme for system preference with window', () => {
    expect(resolveInitialTheme('system', true)).toBe('dark');
  });
});
