import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/components/mit-sailing/admin/catalog/AdminCatalogForm', () => ({
  AdminCatalogForm: (props: { headingKey: string }) => (
    <form data-heading={props.headingKey} />
  ),
}));

vi.mock('@/libs/admin/users/usersAdminHandlers', () => ({
  usersAdminHandlers: {
    getById: mocks.getById,
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.getById.mockReset();
  mocks.getTranslations.mockClear();
  mocks.notFound.mockClear();
  mocks.requirePermission.mockReset();
  mocks.setRequestLocale.mockClear();

  mocks.getById.mockResolvedValue({
    email: 'sailor@example.com',
    id: 'user-1',
    name: 'Sailor One',
  });
  mocks.requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'admin-1', role: 'admin' },
  });
});

describe('admin user pages', () => {
  it('keeps user edit behind the edit-users permission', async () => {
    const { default: AdminUsersEditPage } = await import('./[id]/edit/page');

    await AdminUsersEditPage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith('users.edit', 'en');
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
  });
});
