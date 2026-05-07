import { describe, expect, it } from 'vitest';
import {
  nextThemeToThemePreference,
  themePreferenceToNextTheme,
} from '@/lib/mit-sailing/themePreference';

describe('themePreference', () => {
  it('maps persisted preference to next-themes values', () => {
    expect(themePreferenceToNextTheme('SYSTEM')).toBe('system');
    expect(themePreferenceToNextTheme('LIGHT')).toBe('light');
    expect(themePreferenceToNextTheme('DARK')).toBe('dark');
  });

  it('maps next-themes values to persisted preference', () => {
    expect(nextThemeToThemePreference('system')).toBe('SYSTEM');
    expect(nextThemeToThemePreference('light')).toBe('LIGHT');
    expect(nextThemeToThemePreference('dark')).toBe('DARK');
  });
});
