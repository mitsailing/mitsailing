import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

const mocks = vi.hoisted(() => ({
  connection: vi.fn(),
  createNewsletterBroadcastAction: vi.fn(),
  createNewsletterListAction: vi.fn(),
  createNewsletterTemplateAction: vi.fn(),
  getAdminEmailTemplateDetail: vi.fn(),
  getAdminEmailTemplateList: vi.fn(),
  getAdminNewsletterBroadcasts: vi.fn(),
  getAdminNewsletterLists: vi.fn(),
  getAdminNewsletterSubscribers: vi.fn(),
  getAdminNewsletterTemplates: vi.fn(),
  getTranslations: vi.fn(),
  requirePermission: vi.fn(),
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

vi.mock(
  '@/components/mit-sailing/admin/email-templates/AdminEmailTemplateEditor',
  () => ({
    AdminEmailTemplateEditor: () => null,
  })
);

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
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/email-templates/emailTemplateAdminActions', () => ({
  publishEmailTemplateRevisionAction: vi.fn(),
  saveEmailTemplateDraftAction: vi.fn(),
  sendEmailTemplateTestAction: vi.fn(),
}));

vi.mock('@/libs/email-templates/emailTemplateAdminQueries', () => ({
  getAdminEmailTemplateDetail: mocks.getAdminEmailTemplateDetail,
  getAdminEmailTemplateList: mocks.getAdminEmailTemplateList,
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

type AdminPageModule = {
  default: (props: ReturnType<typeof pageProps>) => Promise<unknown>;
};

function isAdminPageModule(value: unknown): value is AdminPageModule {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof Reflect.get(value, 'default') === 'function'
  );
}

function pageProps() {
  return {
    params: Promise.resolve({ locale: 'en' }),
    searchParams: Promise.resolve({}),
  };
}

async function loadAdminPage(path: string) {
  const pageModule: unknown = await import(path);
  if (!isAdminPageModule(pageModule)) {
    throw new TypeError(`Expected ${path} to export a page component.`);
  }
  return pageModule.default;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue((key: string) => key);
  mocks.requirePermission.mockRejectedValue(new Error('newsletter required'));
  mocks.getAdminNewsletterBroadcasts.mockResolvedValue([]);
  mocks.getAdminEmailTemplateDetail.mockResolvedValue(null);
  mocks.getAdminEmailTemplateList.mockResolvedValue([]);
  mocks.getAdminNewsletterLists.mockResolvedValue([]);
  mocks.getAdminNewsletterSubscribers.mockResolvedValue([]);
  mocks.getAdminNewsletterTemplates.mockResolvedValue([]);
});

describe('newsletter admin pages', () => {
  it('requires newsletter management before rendering sensitive newsletter pages', async () => {
    const pages = [
      { name: 'broadcasts', path: './newsletter-broadcasts/page' },
      { name: 'new broadcast', path: './newsletter-broadcasts/new/page' },
      { name: 'email templates', path: './email-templates/page' },
      {
        name: 'email template detail',
        path: './email-templates/[key]/page',
      },
      { name: 'lists', path: './newsletter-lists/page' },
      { name: 'new list', path: './newsletter-lists/new/page' },
      { name: 'subscribers', path: './newsletter-subscribers/page' },
      { name: 'templates', path: './newsletter-templates/page' },
      { name: 'new template', path: './newsletter-templates/new/page' },
    ];

    for (const page of pages) {
      vi.clearAllMocks();
      mocks.getTranslations.mockResolvedValue((key: string) => key);
      mocks.requirePermission.mockRejectedValue(
        new Error('newsletter required')
      );

      const Page = await loadAdminPage(page.path);
      await expect(Page(pageProps())).rejects.toThrow('newsletter required');
      expect(mocks.requirePermission, page.name).toHaveBeenCalledWith(
        Permission.NEWSLETTER_MANAGE,
        'en'
      );
      expect(
        mocks.getAdminNewsletterBroadcasts,
        page.name
      ).not.toHaveBeenCalled();
      expect(
        mocks.getAdminEmailTemplateDetail,
        page.name
      ).not.toHaveBeenCalled();
      expect(mocks.getAdminEmailTemplateList, page.name).not.toHaveBeenCalled();
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
