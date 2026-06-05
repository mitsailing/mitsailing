import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import PrintPage from './print/page';
import QuickPrintPage from './quick-print/page';

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

const pages = [
  { label: 'print', Page: PrintPage },
  { label: 'quick print', Page: QuickPrintPage },
];

describe('SailingCardPdfRedirectPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(pages)('redirects $label to the inline PDF route', async (props) => {
    mocks.requirePermission.mockResolvedValue({ user: { id: 'admin-1' } });

    await expect(
      props.Page({
        params: Promise.resolve({ id: 'user/1', locale: 'en' }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:/api/admin/users/user%2F1/sailing-card/pdf'
    );

    expect(mocks.setRequestLocale).toHaveBeenLastCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenLastCalledWith(
      Permission.CARDS_PRINT,
      'en'
    );
  });
});
