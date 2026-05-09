import { describe, expect, it } from 'vitest';
import { resolveInitialTheme } from '@/components/shell/AppThemeProvider';

describe('AppThemeProvider', () => {
  it('initializes resolved theme from explicit dark preference', () => {
    expect(resolveInitialTheme('dark')).toBe('dark');
  });

  it('initializes resolved theme from non-dark preferences without window', () => {
    expect(resolveInitialTheme('light')).toBe('light');
    expect(resolveInitialTheme('system', false)).toBe('light');
    expect(resolveInitialTheme('system', true)).toBe('dark');
  });
});
