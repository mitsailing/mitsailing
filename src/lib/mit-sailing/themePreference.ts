export type NextColorScheme = 'system' | 'light' | 'dark';

/** Serializable theme preference (matches Prisma `ThemePreference` enum values). */
export type ThemePreferenceValue = 'SYSTEM' | 'LIGHT' | 'DARK';

/**
 * Maps persisted Prisma enum to the string `next-themes` expects.
 *
 * @param preference - User's stored theme preference
 * @returns next-themes theme name
 */
export function themePreferenceToNextTheme(
  preference: ThemePreferenceValue
): NextColorScheme {
  if (preference === 'DARK') {
    return 'dark';
  }
  if (preference === 'LIGHT') {
    return 'light';
  }
  return 'system';
}

/**
 * Maps `next-themes` value to the Prisma enum for persistence.
 *
 * @param theme - Active next-themes theme
 * @returns Prisma `ThemePreference` value
 */
export function nextThemeToThemePreference(
  theme: NextColorScheme
): ThemePreferenceValue {
  if (theme === 'dark') {
    return 'DARK';
  }
  if (theme === 'light') {
    return 'LIGHT';
  }
  return 'SYSTEM';
}
