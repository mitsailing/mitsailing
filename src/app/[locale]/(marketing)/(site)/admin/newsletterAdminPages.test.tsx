import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  createNewsletterBroadcastAction: vi.fn(),
  createNewsletterListAction: vi.fn(),
  createNewsletterTemplateAction: vi.fn(),
  getAdminNewsletterBroadcasts: vi.fn(),
  getAdminNewsletterLists: vi.fn(),
  getAdminNewsletterSubscribers: vi.fn(),
  getAdminNewsletterTemplates: vi.fn(),
  getTranslations: vi.fn(),
  requireAdmin: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/server', () => ({
  connection: mocks.connection,
}));

vi.mock('@/components/mit-sailing/admin/AdminPageHeader', () => ({
  AdminPageHeader: () => null,
}));

vi.mock('@/components/ui/button', () => ({
  Button: () => null,
}));

vi.mock('@/components/ui/input', () => ({
  Input: () => null,
}));

vi.mock('@/components/ui/label', () => ({
  Label: () => null,
}));

vi.mock('@/components/ui/table', () => ({
  Table: () => null,
  TableBody: () => null,
  TableCell: () => null,
  TableHead: () => null,
  TableHeader: () => null,
  TableRow: () => null,
}));

vi.mock('@/components/ui/textarea', () => ({
  Textarea: () => null,
}));

vi.mock('@/lib/mit-sailing/tokens', () => ({
  adminNativeSelectClassName: 'select',
}));

vi.mock('@/libs/I18nNavigation', () => ({
  Link: () => null,
}));

vi.mock('@/libs/auth/dal', () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock('@/libs/newsletter/newsletterAdminActions', () => ({
  createNewsletterBroadcastAction: mocks.createNewsletterBroadcastAction,
  createNewsletterListAction: mocks.createNewsletterListAction,
  createNewsletterTemplateAction: mocks.createNewsletterTemplateAction,
}));

vi.mock('@/libs/newsletter/newsletterBroadcasts', () => ({
  getAdminNewsletterBroadcasts: mocks.getAdminNewsletterBroadcasts,
  getAdminNewsletterLists: mocks.getAdminNewsletterLists,
  getAdminNewsletterSubscribers: mocks.getAdminNewsletterSubscribers,
  getAdminNewsletterTemplates: mocks.getAdminNewsletterTemplates,
}));

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve({}),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.requireAdmin.mockRejectedValue(new Error('admin required'));
  mocks.getAdminNewsletterBroadcasts.mockResolvedValue([]);
  mocks.getAdminNewsletterLists.mockResolvedValue([]);
  mocks.getAdminNewsletterSubscribers.mockResolvedValue([]);
  mocks.getAdminNewsletterTemplates.mockResolvedValue([]);
});

describe('newsletter admin pages', () => {
  it('requires admin before rendering sensitive newsletter pages', async () => {
    const pages = [
      {
        load: async () => {
          const pageModule = await import('./newsletter-broadcasts/page');
          return pageModule.default;
        },
        name: 'broadcasts',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-broadcasts/new/page');
          return pageModule.default;
        },
        name: 'new broadcast',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-lists/page');
          return pageModule.default;
        },
        name: 'lists',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-lists/new/page');
          return pageModule.default;
        },
        name: 'new list',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-subscribers/page');
          return pageModule.default;
        },
        name: 'subscribers',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-templates/page');
          return pageModule.default;
        },
        name: 'templates',
      },
      {
        load: async () => {
          const pageModule = await import('./newsletter-templates/new/page');
          return pageModule.default;
        },
        name: 'new template',
      },
    ];

    for (const page of pages) {
      vi.clearAllMocks();
      mocks.getTranslations.mockResolvedValue((key: string) => key);
      mocks.requireAdmin.mockRejectedValue(new Error('admin required'));

      const Page = await page.load();
      await expect(Page(pageProps())).rejects.toThrow('admin required');
      expect(mocks.requireAdmin, page.name).toHaveBeenCalledWith('en');
      expect(
        mocks.getAdminNewsletterBroadcasts,
        page.name
      ).not.toHaveBeenCalled();
      expect(mocks.getAdminNewsletterLists, page.name).not.toHaveBeenCalled();
      expect(
        mocks.getAdminNewsletterSubscribers,
        page.name
      ).not.toHaveBeenCalled();
      expect(
        mocks.getAdminNewsletterTemplates,
        page.name
      ).not.toHaveBeenCalled();
    }
  });
});
