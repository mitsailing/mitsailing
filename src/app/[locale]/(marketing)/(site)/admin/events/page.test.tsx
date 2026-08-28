import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AdminEventsListViewProps = {
  categories: readonly { id: string; name: string }[];
  filterAction: string;
  filters: {
    categoryId?: string;
    query?: string;
    scope?: string;
  };
  rows: readonly { id: string; name: string }[];
  t: (key: string) => string;
};

const mocks = vi.hoisted(() => ({
  AdminEventsListView: vi.fn((props: AdminEventsListViewProps) => (
    <div data-testid="admin-events-list">{props.rows.length}</div>
  )),
  getPathname: vi.fn((props: { href: string; locale: string }) => props.href),
  getTranslations: vi.fn(),
  listAdminEventCategories: vi.fn(),
  listAdminEventRowsPage: vi.fn(),
  requireAdminEventListAccess: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/admin/events/AdminEventsListView', () => ({
  AdminEventsListView: mocks.AdminEventsListView,
}));

vi.mock('@/libs/admin/events/eventAdminAuthorization', () => ({
  requireAdminEventListAccess: mocks.requireAdminEventListAccess,
}));

vi.mock('@/libs/admin/events/eventAdminQueries', () => ({
  ADMIN_EVENTS_PAGE_SIZE: 25,
  listAdminEventCategories: mocks.listAdminEventCategories,
  listAdminEventRowsPage: mocks.listAdminEventRowsPage,
}));

vi.mock('@/libs/I18nNavigation', () => ({
  getPathname: mocks.getPathname,
}));

function params() {
  return { locale: 'en' };
}

describe('AdminEventsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    mocks.listAdminEventCategories.mockResolvedValue([
      { id: 'cat-1', name: 'Clinics' },
    ]);
    mocks.listAdminEventRowsPage.mockResolvedValue({
      page: 1,
      pageSize: 25,
      rows: [{ id: 'event-1', name: 'Intro Sail' }],
      total: 1,
    });
    mocks.requireAdminEventListAccess.mockResolvedValue({
      authContext: { id: 'admin-1' },
    });
  });

  it('requires list access and passes admin filters to the event list', async () => {
    const { default: AdminEventsListPage } = await import('./page');

    render(
      await AdminEventsListPage({
        params: Promise.resolve(params()),
        searchParams: Promise.resolve({
          category: 'cat-1',
          q: 'intro',
          scope: 'all',
        }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireAdminEventListAccess).toHaveBeenCalledWith('en');
    expect(mocks.listAdminEventRowsPage).toHaveBeenCalledWith({
      authContext: { id: 'admin-1' },
      categoryId: 'cat-1',
      page: 1,
      pageSize: 25,
      query: 'intro',
      scope: 'all',
    });
    expect(mocks.getPathname).toHaveBeenCalledWith({
      href: '/admin/events',
      locale: 'en',
    });
    expect(mocks.AdminEventsListView).toHaveBeenCalledWith(
      expect.objectContaining({
        categories: [{ id: 'cat-1', name: 'Clinics' }],
        filterAction: '/admin/events',
        filters: { categoryId: 'cat-1', query: 'intro', scope: 'all' },
        pagination: {
          page: 1,
          pageSize: 25,
          rows: [{ id: 'event-1', name: 'Intro Sail' }],
          total: 1,
        },
        rows: [{ id: 'event-1', name: 'Intro Sail' }],
      }),
      undefined
    );
  });

  it('builds translated admin event metadata', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({
        params: Promise.resolve(params()),
        searchParams: Promise.resolve({}),
      })
    ).resolves.toEqual({ title: 'meta_title_admin_events' });
    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'MitSailingRoutes',
    });
  });
});
