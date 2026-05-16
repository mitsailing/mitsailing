import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  getTranslations: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/SiteSectionMain', () => ({
  SiteSectionMain: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/components/mit-sailing/SiteSectionShell', () => ({
  SiteSectionShell: (props: { children: React.ReactNode }): React.ReactNode =>
    props.children,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    newsletterBroadcast: {
      findMany: mocks.findMany,
    },
  },
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en' }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findMany.mockResolvedValue([]);
  mocks.getTranslations.mockResolvedValue((key: string) => key);
});

describe('NewsletterArchivePage', () => {
  it('loads sent broadcasts from public lists', async () => {
    const pageModule = await import('./page');

    await pageModule.default(pageProps());

    expect(mocks.findMany).toHaveBeenCalledWith({
      include: { primaryList: true },
      orderBy: { sentAt: 'desc' },
      take: 50,
      where: {
        primaryList: { is: { visibility: 'public' } },
        sentAt: { not: null },
        status: 'sent',
      },
    });
  });
});
