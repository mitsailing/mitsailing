import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';

type ViewProps = {
  accessMode?: string;
  categories?: readonly unknown[];
  errorCode?: string | null;
  event?: unknown;
  filter?: string;
  locale?: string;
  users?: readonly unknown[];
};

const mocks = vi.hoisted(() => ({
  AdminEventCreateFormView: vi.fn((props: ViewProps) => (
    <div data-testid="admin-event-create">{props.locale}</div>
  )),
  AdminEventDeleteView: vi.fn((props: ViewProps) => (
    <div data-testid="admin-event-delete">{props.locale}</div>
  )),
  AdminEventFormView: vi.fn((props: ViewProps) => (
    <div data-testid="admin-event-form">{props.locale}</div>
  )),
  AdminEventShowView: vi.fn((props: ViewProps) => (
    <div data-testid="admin-event-show">{props.locale}</div>
  )),
  getAdminEventDeleteBySlug: vi.fn(),
  getAdminEventEditorDataBySlug: vi.fn(),
  getAdminEventShowBySlug: vi.fn(),
  getI18nPath: vi.fn((path: string) => path),
  getTranslations: vi.fn(),
  listAdminEventCategories: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireAdminEventAccess: vi.fn(),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock(
  '@/components/mit-sailing/admin/events/AdminEventCreateFormView',
  () => ({
    AdminEventCreateFormView: mocks.AdminEventCreateFormView,
  })
);

vi.mock('@/components/mit-sailing/admin/events/AdminEventDeleteView', () => ({
  AdminEventDeleteView: mocks.AdminEventDeleteView,
}));

vi.mock('@/components/mit-sailing/admin/events/AdminEventFormView', () => ({
  AdminEventFormView: mocks.AdminEventFormView,
}));

vi.mock('@/components/mit-sailing/admin/events/AdminEventShowView', () => ({
  AdminEventShowView: mocks.AdminEventShowView,
}));

vi.mock('@/libs/admin/events/eventAdminAuthorization', () => ({
  requireAdminEventAccess: mocks.requireAdminEventAccess,
}));

vi.mock('@/libs/admin/events/eventAdminQueries', () => ({
  getAdminEventDeleteBySlug: mocks.getAdminEventDeleteBySlug,
  getAdminEventEditorDataBySlug: mocks.getAdminEventEditorDataBySlug,
  getAdminEventShowBySlug: mocks.getAdminEventShowBySlug,
  listAdminEventCategories: mocks.listAdminEventCategories,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: mocks.getI18nPath,
}));

const access = {
  accessMode: 'editable',
  db: { source: 'admin-event-db' },
};

const categories = [{ id: 'cat-1', name: 'Clinic' }];
const event = { id: 'event-1', name: 'Intro Sail', slug: 'intro-sail' };
const users = [{ id: 'user-1', name: 'Admin User' }];

function routeParams(slug = event.slug) {
  return { locale: 'en', slug };
}

function localeParams() {
  return { locale: 'en' };
}

function searchParams(params: { error?: string; status?: string } = {}) {
  return params;
}

function translatedKey(key: string, values?: { slug?: string }) {
  return values?.slug ? `${key}:${values.slug}` : key;
}

describe('Admin event route pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminEventDeleteBySlug.mockResolvedValue(event);
    mocks.getAdminEventEditorDataBySlug.mockResolvedValue({
      categories,
      event,
      users,
    });
    mocks.getAdminEventShowBySlug.mockResolvedValue(event);
    mocks.getTranslations.mockResolvedValue(translatedKey);
    mocks.listAdminEventCategories.mockResolvedValue(categories);
    mocks.requireAdminEventAccess.mockResolvedValue(access);
  });

  it('passes read-only access and registration filters to the show view', async () => {
    const { default: AdminEventShowPage } = await import('./[slug]/page');

    render(
      await AdminEventShowPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(
          searchParams({ error: 'capacity_full', status: 'pending' })
        ),
      })
    );

    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'readOnly',
      slug: event.slug,
    });
    expect(mocks.getAdminEventShowBySlug).toHaveBeenCalledWith({
      accessMode: 'editable',
      db: access.db,
      slug: event.slug,
    });
    expect(mocks.AdminEventShowView).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'capacity_full',
        event,
        filter: 'pending',
        locale: 'en',
      }),
      undefined
    );
  });

  it('normalizes supported and unsupported show registration filters', async () => {
    const { default: AdminEventShowPage } = await import('./[slug]/page');

    for (const status of ['approved', 'cancelled', 'unexpected']) {
      render(
        await AdminEventShowPage({
          params: Promise.resolve(routeParams()),
          searchParams: Promise.resolve(searchParams({ status })),
        })
      );
    }

    expect(
      mocks.AdminEventShowView.mock.calls.map(([props]) => props.filter)
    ).toEqual(['approved', 'cancelled', 'all']);
  });

  it('returns not found when the show page has no access or event data', async () => {
    const { default: AdminEventShowPage } = await import('./[slug]/page');
    mocks.requireAdminEventAccess.mockResolvedValueOnce(null);

    await expect(
      AdminEventShowPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    mocks.requireAdminEventAccess.mockResolvedValueOnce(access);
    mocks.getAdminEventShowBySlug.mockResolvedValueOnce(null);
    await expect(
      AdminEventShowPage({
        params: Promise.resolve(routeParams('missing-event')),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('passes editor data and access mode to the edit view', async () => {
    const { default: AdminEventEditPage } = await import('./[slug]/edit/page');

    render(
      await AdminEventEditPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams({ error: 'stale_slug' })),
      })
    );

    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'readOnly',
      slug: event.slug,
    });
    expect(mocks.AdminEventFormView).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'editable',
        categories,
        errorCode: 'stale_slug',
        event,
        locale: 'en',
        users,
      }),
      undefined
    );
  });

  it('returns not found when the edit page has no access or event data', async () => {
    const { default: AdminEventEditPage } = await import('./[slug]/edit/page');
    mocks.requireAdminEventAccess.mockResolvedValueOnce(null);

    await expect(
      AdminEventEditPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    mocks.requireAdminEventAccess.mockResolvedValueOnce(access);
    mocks.getAdminEventEditorDataBySlug.mockResolvedValueOnce({
      categories,
      event: null,
      users,
    });
    await expect(
      AdminEventEditPage({
        params: Promise.resolve(routeParams('missing-event')),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('requires editable access and passes event data to the delete view', async () => {
    const { default: AdminEventDeletePage } =
      await import('./[slug]/delete/page');

    render(
      await AdminEventDeletePage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(
          searchParams({ error: 'has_registrations' })
        ),
      })
    );

    expect(mocks.requireAdminEventAccess).toHaveBeenCalledWith({
      locale: 'en',
      minimumAccessMode: 'editable',
      slug: event.slug,
    });
    expect(mocks.AdminEventDeleteView).toHaveBeenCalledWith(
      expect.objectContaining({
        errorCode: 'has_registrations',
        event,
        locale: 'en',
      }),
      undefined
    );
  });

  it('returns not found when the delete page has no access or event data', async () => {
    const { default: AdminEventDeletePage } =
      await import('./[slug]/delete/page');
    mocks.requireAdminEventAccess.mockResolvedValueOnce(null);

    await expect(
      AdminEventDeletePage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    mocks.requireAdminEventAccess.mockResolvedValueOnce(access);
    mocks.getAdminEventDeleteBySlug.mockResolvedValueOnce(null);
    await expect(
      AdminEventDeletePage({
        params: Promise.resolve(routeParams('missing-event')),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('requires event management permission and categories on the new page', async () => {
    const { default: AdminEventNewPage } = await import('./new/page');

    render(
      await AdminEventNewPage({
        params: Promise.resolve(localeParams()),
        searchParams: Promise.resolve(searchParams({ error: 'invalid_dates' })),
      })
    );

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EVENTS_MANAGE,
      'en'
    );
    expect(mocks.AdminEventCreateFormView).toHaveBeenCalledWith(
      expect.objectContaining({
        categories,
        errorCode: 'invalid_dates',
        locale: 'en',
      }),
      undefined
    );
  });

  it('passes null error codes when admin event form routes have no error query', async () => {
    const edit = await import('./[slug]/edit/page');
    const deletePage = await import('./[slug]/delete/page');
    const create = await import('./new/page');

    render(
      await edit.default({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    );
    render(
      await deletePage.default({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    );
    render(
      await create.default({
        params: Promise.resolve(localeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    );

    expect(mocks.AdminEventFormView.mock.lastCall?.[0].errorCode).toBeNull();
    expect(mocks.AdminEventDeleteView.mock.lastCall?.[0].errorCode).toBeNull();
    expect(
      mocks.AdminEventCreateFormView.mock.lastCall?.[0].errorCode
    ).toBeNull();
  });

  it('redirects registrations to the canonical show-page review anchor', async () => {
    const { default: AdminEventRegistrationsPage } =
      await import('./[slug]/registrations/page');

    await expect(
      AdminEventRegistrationsPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(
          searchParams({ error: 'capacity_full', status: 'approved' })
        ),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail?error=capacity_full&status=approved#registrations'
    );
  });

  it('drops unsupported registration status redirects and requires access', async () => {
    const { default: AdminEventRegistrationsPage } =
      await import('./[slug]/registrations/page');

    await expect(
      AdminEventRegistrationsPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams({ status: 'unknown' })),
      })
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail#registrations');

    mocks.requireAdminEventAccess.mockResolvedValueOnce(null);
    await expect(
      AdminEventRegistrationsPage({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('builds metadata for every admin event route', async () => {
    const show = await import('./[slug]/page');
    const edit = await import('./[slug]/edit/page');
    const deletePage = await import('./[slug]/delete/page');
    const create = await import('./new/page');
    const registrations = await import('./[slug]/registrations/page');

    await expect(
      show.generateMetadata({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).resolves.toEqual({ title: 'meta_title_admin_event_show:intro-sail' });
    await expect(
      edit.generateMetadata({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).resolves.toEqual({ title: 'meta_title_admin_event_edit:intro-sail' });
    await expect(
      deletePage.generateMetadata({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).resolves.toEqual({ title: 'meta_title_admin_event_delete:intro-sail' });
    await expect(
      create.generateMetadata({
        params: Promise.resolve(localeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).resolves.toEqual({ title: 'meta_title_admin_event_new' });
    await expect(
      registrations.generateMetadata({
        params: Promise.resolve(routeParams()),
        searchParams: Promise.resolve(searchParams()),
      })
    ).resolves.toEqual({
      title: 'meta_title_admin_registrations:intro-sail',
    });
  });
});
