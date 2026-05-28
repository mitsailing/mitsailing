import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSiteTextMessages } from '@/libs/site-text/siteTextMessages';
import type { SiteTextOverrideInput } from '@/libs/site-text/siteTextMessages';

vi.mock('server-only', () => ({}));

type FindManyMock = (query: unknown) => Promise<SiteTextOverrideInput[]>;
type LoggerErrorMock = (message: string) => void;

const loaderMocks = vi.hoisted(() => ({
  findMany: vi.fn<FindManyMock>(),
  loggerError: vi.fn<LoggerErrorMock>(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    siteTextOverride: {
      findMany: loaderMocks.findMany,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: loaderMocks.loggerError,
  },
}));

describe('siteTextMessageLoader', () => {
  beforeEach(async () => {
    const { clearMergedSiteTextMessagesCache } =
      await import('@/libs/site-text/siteTextMessageLoader');

    loaderMocks.findMany.mockReset();
    loaderMocks.loggerError.mockReset();
    clearMergedSiteTextMessagesCache('en');
    clearMergedSiteTextMessagesCache('fr');
  });

  describe('getMergedSiteTextMessages', () => {
    it('applies English database overrides and caches the merged catalog', async () => {
      const { getMergedSiteTextMessages } =
        await import('@/libs/site-text/siteTextMessageLoader');
      loaderMocks.findMany.mockResolvedValueOnce([
        {
          namespace: 'MitSailingHome',
          key: 'hero_title',
          value: 'Learn to sail at MIT',
        },
      ]);

      const first = await getMergedSiteTextMessages('en');
      const second = await getMergedSiteTextMessages('en');

      expect(first.MitSailingHome?.hero_title).toBe('Learn to sail at MIT');
      expect(first.SignInPage?.heading).toBe(
        defaultSiteTextMessages.SignInPage?.heading
      );
      expect(second).toBe(first);
      expect(loaderMocks.findMany).toHaveBeenCalledTimes(1);
      expect(loaderMocks.findMany).toHaveBeenCalledWith({
        where: { locale: 'en' },
        select: {
          namespace: true,
          key: true,
          value: true,
        },
      });
    });

    it('returns file-backed defaults for unsupported locales without querying overrides', async () => {
      const { getMergedSiteTextMessages } =
        await import('@/libs/site-text/siteTextMessageLoader');

      const messages = await getMergedSiteTextMessages('fr');

      expect(messages).toBe(defaultSiteTextMessages);
      expect(loaderMocks.findMany).not.toHaveBeenCalled();
    });

    it('reloads English overrides after clearing the locale cache', async () => {
      const { clearMergedSiteTextMessagesCache, getMergedSiteTextMessages } =
        await import('@/libs/site-text/siteTextMessageLoader');
      loaderMocks.findMany
        .mockResolvedValueOnce([
          {
            namespace: 'MitSailingHome',
            key: 'hero_title',
            value: 'First title',
          },
        ])
        .mockResolvedValueOnce([
          {
            namespace: 'MitSailingHome',
            key: 'hero_title',
            value: 'Second title',
          },
        ]);

      const first = await getMergedSiteTextMessages('en');
      clearMergedSiteTextMessagesCache('en');
      const second = await getMergedSiteTextMessages('en');

      expect(first.MitSailingHome?.hero_title).toBe('First title');
      expect(second.MitSailingHome?.hero_title).toBe('Second title');
      expect(loaderMocks.findMany).toHaveBeenCalledTimes(2);
    });

    it('falls back to file-backed defaults when override loading fails', async () => {
      const { getMergedSiteTextMessages } =
        await import('@/libs/site-text/siteTextMessageLoader');
      loaderMocks.findMany.mockRejectedValueOnce(new Error('database down'));

      const messages = await getMergedSiteTextMessages('en');

      expect(messages).toBe(defaultSiteTextMessages);
      expect(loaderMocks.loggerError).toHaveBeenCalledWith(
        'Failed to load site text overrides: database down'
      );
    });
  });
});
