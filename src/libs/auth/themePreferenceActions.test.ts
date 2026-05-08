import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getI18nPath, getSession, revalidatePath, userUpdate } = vi.hoisted(
  () => ({
    getI18nPath: vi.fn((url: string, locale: string) =>
      locale === 'en' ? url : `/${locale}${url}`
    ),
    getSession: vi.fn(),
    revalidatePath: vi.fn(),
    userUpdate: vi.fn(),
  })
);

vi.mock('next/cache', () => ({
  revalidatePath,
}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      update: userUpdate,
    },
  },
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath,
}));

beforeEach(() => {
  getI18nPath.mockClear();
  getSession.mockReset();
  revalidatePath.mockClear();
  userUpdate.mockReset();

  getSession.mockResolvedValue(null);
  userUpdate.mockResolvedValue({});
});

describe('updateThemePreferenceAction', () => {
  it('profile owner cannot save an invalid theme value', async () => {
    const { updateThemePreferenceAction } =
      await import('@/libs/auth/themePreferenceActions');

    await expect(
      // @ts-expect-error - Exercises runtime validation for untrusted input.
      updateThemePreferenceAction('en', 'sepia')
    ).resolves.toEqual({ ok: false, error: 'invalid' });

    expect(getSession).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('visitor cannot save a theme preference without a session', async () => {
    const { updateThemePreferenceAction } =
      await import('@/libs/auth/themePreferenceActions');

    await expect(updateThemePreferenceAction('en', 'dark')).resolves.toEqual({
      ok: false,
      error: 'unauthorized',
    });

    expect(userUpdate).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('profile owner saves a theme preference and refreshes the locale layout', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    const { updateThemePreferenceAction } =
      await import('@/libs/auth/themePreferenceActions');

    await expect(updateThemePreferenceAction('fr', 'dark')).resolves.toEqual({
      ok: true,
    });

    expect(userUpdate).toHaveBeenCalledWith({
      data: { themePreference: 'DARK' },
      where: { id: 'user-1' },
    });
    expect(getI18nPath).toHaveBeenCalledWith('/', 'fr');
    expect(revalidatePath).toHaveBeenCalledWith('/fr/', 'layout');
  });
});
