'use server';

import { revalidatePath } from 'next/cache';
import { nextThemeToThemePreference } from '@/lib/mit-sailing/themePreference';
import type { NextColorScheme } from '@/lib/mit-sailing/themePreference';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

export type UpdateThemePreferenceResult =
  | { ok: true }
  | { ok: false; error: 'unauthorized' | 'invalid' };

/**
 * Persists appearance (light / dark / system) for the current user.
 *
 * @param locale - Active locale for session verification
 * @param theme - next-themes value to store
 * @returns Success or error code
 */
export async function updateThemePreferenceAction(
  locale: string,
  theme: NextColorScheme
): Promise<UpdateThemePreferenceResult> {
  const allowed: NextColorScheme[] = ['system', 'light', 'dark'];
  if (!allowed.includes(theme)) {
    return { ok: false, error: 'invalid' };
  }

  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: 'unauthorized' };
  }

  const preference = nextThemeToThemePreference(theme);
  await prisma.user.update({
    data: { themePreference: preference },
    where: { id: session.user.id },
  });

  revalidatePath(getI18nPath('/', locale), 'layout');
  return { ok: true };
}
