import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  legacyRedirectFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Env', () => ({
  Env: {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    legacyRedirect: {
      findUnique: mocks.legacyRedirectFindUnique,
    },
  },
}));

const {
  normalizeLegacyRedirectPath,
  normalizeLegacyRedirectTargetPath,
  resolveLegacyRedirect,
} = await import('@/libs/mit-sailing/legacyRedirects');

describe('legacyRedirects', () => {
  beforeEach(() => {
    mocks.legacyRedirectFindUnique.mockReset();
  });

  it('normalizes source paths and drops query strings', () => {
    expect(normalizeLegacyRedirectPath('calendar.php?view=month')).toBe(
      '/calendar.php'
    );
    expect(normalizeLegacyRedirectPath('/info/boats.php/')).toBe(
      '/info/boats.php'
    );
    expect(normalizeLegacyRedirectPath('/INFO/Boats.HTML///')).toBe(
      '/INFO/Boats.HTML'
    );
    expect(normalizeLegacyRedirectPath('/calendar')).toBeNull();
    expect(normalizeLegacyRedirectPath('/calendar.php/extra')).toBeNull();
    expect(normalizeLegacyRedirectPath('/calendar.php#anchor')).toBeNull();
  });

  it('accepts only internal target paths', () => {
    expect(normalizeLegacyRedirectTargetPath('/calendar/')).toBe('/calendar');
    expect(normalizeLegacyRedirectTargetPath('https://example.com')).toBeNull();
    expect(normalizeLegacyRedirectTargetPath('/api/private')).toBeNull();
    expect(
      normalizeLegacyRedirectTargetPath('//example.com/calendar')
    ).toBeNull();
  });

  it.each(['/api?x=1', '/_next?x=1', '/monitoring#status'])(
    'rejects blocked target fragments for %s',
    (targetPath) => {
      expect(normalizeLegacyRedirectTargetPath(targetPath)).toBeNull();
    }
  );

  it('rejects target query strings on app paths', () => {
    expect(
      normalizeLegacyRedirectTargetPath('/calendar?view=month')
    ).toBeNull();
    expect(normalizeLegacyRedirectTargetPath('/calendar')).toBe('/calendar');
  });

  it('returns localized target paths for legacy redirect rows', async () => {
    mocks.legacyRedirectFindUnique.mockResolvedValue({
      targetPath: '/calendar/',
    });

    await expect(
      resolveLegacyRedirect({
        locale: 'en',
        pathname: 'calendar.php?view=month',
      })
    ).resolves.toBe('/calendar');
    expect(mocks.legacyRedirectFindUnique).toHaveBeenCalledWith({
      select: { targetPath: true },
      where: { sourcePath: '/calendar.php' },
    });
  });

  it('returns null for invalid sources and invalid stored targets', async () => {
    await expect(
      resolveLegacyRedirect({
        locale: 'en',
        pathname: '/calendar',
      })
    ).resolves.toBeNull();
    expect(mocks.legacyRedirectFindUnique).not.toHaveBeenCalled();

    mocks.legacyRedirectFindUnique.mockResolvedValue({
      targetPath: '/_next/static/app.js',
    });

    await expect(
      resolveLegacyRedirect({
        locale: 'en',
        pathname: '/calendar.php',
      })
    ).resolves.toBeNull();
  });
});
