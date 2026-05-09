import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
const findUnique = vi.fn();

vi.mock('server-only', () => ({}));

vi.mock('@/libs/auth/dal', () => ({
  getSession,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

describe('getDefaultThemeForRootLayout', () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
    findUnique.mockReset();
  });

  it('returns system when the visitor is signed out', async () => {
    getSession.mockResolvedValue(null);
    const { getDefaultThemeForRootLayout } =
      await import('@/libs/theme-layout');
    await expect(getDefaultThemeForRootLayout()).resolves.toBe('system');
  });

  it('maps the signed-in user stored preference', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    findUnique.mockResolvedValue({ themePreference: 'DARK' });
    const { getDefaultThemeForRootLayout } =
      await import('@/libs/theme-layout');
    await expect(getDefaultThemeForRootLayout()).resolves.toBe('dark');
  });

  it('defaults missing preference rows to system', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1' } });
    findUnique.mockResolvedValue(null);
    const { getDefaultThemeForRootLayout } =
      await import('@/libs/theme-layout');
    await expect(getDefaultThemeForRootLayout()).resolves.toBe('system');
  });
});
