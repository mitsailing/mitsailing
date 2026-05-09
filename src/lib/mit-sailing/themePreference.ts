export type AppColorScheme = 'system' | 'light' | 'dark';

/** Serializable theme preference (matches Prisma `ThemePreference` enum values). */
export type ThemePreferenceValue = 'SYSTEM' | 'LIGHT' | 'DARK';

/**
 * Maps persisted Prisma enum to an app color-scheme value.
 *
 * @param preference - User's stored theme preference
 * @returns App color-scheme value
 */
export function themePreferenceToColorScheme(
  preference: ThemePreferenceValue
): AppColorScheme {
  if (preference === 'DARK') {
    return 'dark';
  }
  if (preference === 'LIGHT') {
    return 'light';
  }
  return 'system';
}

/**
 * Maps app color-scheme value to the Prisma enum for persistence.
 *
 * @param theme - Active app color scheme
 * @returns Prisma `ThemePreference` value
 */
export function colorSchemeToThemePreference(
  theme: AppColorScheme
): ThemePreferenceValue {
  if (theme === 'dark') {
    return 'DARK';
  }
  if (theme === 'light') {
    return 'LIGHT';
  }
  return 'SYSTEM';
}
