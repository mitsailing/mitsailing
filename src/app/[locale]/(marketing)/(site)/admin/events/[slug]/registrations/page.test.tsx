import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAdminEventRegistrationsBySlug: vi.fn(),
  getTranslations: vi.fn(),
  requireAdminEventAccess: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  setRequestLocale: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn(),
  redirect: mocks.redirect,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/libs/admin/events/eventAdminAuthorization', () => ({
  requireAdminEventAccess: mocks.requireAdminEventAccess,
}));

vi.mock('@/libs/admin/events/eventAdminQueries', () => ({
  getAdminEventRegistrationsBySlug: mocks.getAdminEventRegistrationsBySlug,
}));

vi.mock(
  '@/components/mit-sailing/admin/events/AdminEventRegistrationsView',
  () => ({
    AdminEventRegistrationsView: () => null,
  })
);

describe('AdminEventRegistrationsPage', () => {
  it('redirects to the canonical show page registrations anchor', async () => {
    mocks.requireAdminEventAccess.mockResolvedValue({
      accessMode: 'editable',
      db: {},
    });
    mocks.getAdminEventRegistrationsBySlug.mockResolvedValue({
      id: 'event-1',
      name: 'Intro Sail',
      questions: [],
      registrationCounts: { approved: 0, cancelled: 0, pending: 0 },
      registrations: [],
      slug: 'intro-sail',
    });
    mocks.getTranslations.mockResolvedValue((key: string) => key);
    const { default: AdminEventRegistrationsPage } = await import('./page');

    await expect(
      AdminEventRegistrationsPage({
        params: Promise.resolve({ locale: 'en', slug: 'intro-sail' }),
        searchParams: Promise.resolve({ error: 'capacity_full' }),
      })
    ).rejects.toThrow(
      'NEXT_REDIRECT:/admin/events/intro-sail?error=capacity_full#registrations'
    );
  });
});
