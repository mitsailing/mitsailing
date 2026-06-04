import { describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import AdminUserSailingCardQuickPrintPage from './page';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

describe('AdminUserSailingCardQuickPrintPage', () => {
  it('redirects quick print to the inline PDF route', async () => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'admin-1' } });

    await expect(
      AdminUserSailingCardQuickPrintPage({
        params: Promise.resolve({ id: 'user/1', locale: 'en' }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:/api/admin/users/user%2F1/sailing-card/pdf'
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.CARDS_PRINT,
      'en'
    );
  });
});
