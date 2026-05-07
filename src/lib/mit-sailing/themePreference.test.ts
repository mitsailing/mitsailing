import { describe, expect, it } from 'vitest';
import {
  colorSchemeToThemePreference,
  themePreferenceToColorScheme,
} from '@/lib/mit-sailing/themePreference';

describe('themePreference', () => {
  it('maps persisted preference to color scheme values', () => {
    expect(themePreferenceToColorScheme('SYSTEM')).toBe('system');
    expect(themePreferenceToColorScheme('LIGHT')).toBe('light');
    expect(themePreferenceToColorScheme('DARK')).toBe('dark');
  });

  it('maps color scheme values to persisted preference', () => {
    expect(colorSchemeToThemePreference('system')).toBe('SYSTEM');
    expect(colorSchemeToThemePreference('light')).toBe('LIGHT');
    expect(colorSchemeToThemePreference('dark')).toBe('DARK');
  });
});
