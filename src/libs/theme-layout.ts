import 'server-only';
import { cache } from 'react';
import { themePreferenceToNextTheme } from '@/lib/mit-sailing/themePreference';
import type { NextColorScheme } from '@/lib/mit-sailing/themePreference';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';

/**
 * Resolves the default color scheme for the root layout from the signed-in
 * user's stored preference.
 *
 * @returns next-themes default (`system` when signed out)
 */
export const getDefaultThemeForRootLayout = cache(
  async (): Promise<NextColorScheme> => {
    const session = await getSession();
    if (!session?.user?.id) {
      return 'system';
    }
    const row = await prisma.user.findUnique({
      select: { themePreference: true },
      where: { id: session.user.id },
    });
    return themePreferenceToNextTheme(row?.themePreference ?? 'SYSTEM');
  }
);
