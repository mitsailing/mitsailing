import { describe, expect, it, vi } from 'vitest';
import { EventDetailPageKind } from '@/generated/prisma/enums';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  eventCreate: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  revalidatePath: vi.fn(),
  requirePermission: vi.fn(),
  updateTag: vi.fn(),
  appAuthContextFromSession: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
  unstable_cache: <T>(cachedFunction: T) => cachedFunction,
  updateTag: mocks.updateTag,
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next-intl/server', () => ({
  getTranslations: vi.fn(() => (key: string) => key),
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/zenstack/authContext', () => ({
  appAuthContextFromSession: mocks.appAuthContextFromSession,
}));

vi.mock('@/libs/zenstack/auth', () => ({
  zenstackForAuthContext: mocks.zenstackForAuthContext,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      create: mocks.eventCreate,
    },
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/libs/mit-sailing/sitemapCache', () => ({
  sitemapCatalogCacheTag: 'sitemap-catalog',
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

function validEventFormData(): FormData {
  const formData = new FormData();
  formData.set('name', 'Intro Sail');
  formData.set('shortName', '');
  formData.set('slug', 'intro-sail');
  formData.set('eventCategoryId', 'category-1');
  formData.set('description', 'Learn to sail.');
  formData.set('maxParticipants', '');
  formData.set('registrationStart', '');
  formData.set('registrationEnd', '');
  formData.set('detailPageKind', EventDetailPageKind.standard);
  formData.set('externalDetailUrl', '');
  formData.set('internalNotes', '');
  return formData;
}

describe('createAdminEventAction', () => {
  it('creates an event admin row for the creator', async () => {
    const session = {
      session: { impersonatedBy: null },
      user: {
        appRole: Role.DOCK_STAFF,
        banned: false,
        emailVerified: true,
        id: 'creator-1',
        role: Role.USER,
      },
    };
    mocks.requirePermission.mockResolvedValue(session);
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.DOCK_STAFF,
      id: 'creator-1',
    });
    mocks.zenstackForAuthContext.mockReturnValue({
      event: {
        create: mocks.eventCreate,
      },
    });
    mocks.eventCreate.mockResolvedValue({ id: 'event-1', slug: 'intro-sail' });
    const { createAdminEventAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      createAdminEventAction('en', validEventFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.EVENTS_MANAGE,
      'en'
    );
    expect(mocks.eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          admins: {
            create: expect.objectContaining({
              adminUserId: 'creator-1',
              id: expect.any(String),
            }),
          },
        }),
      })
    );
  });
});

describe('updateAdminEventBasicsAction', () => {
  it('updates event basics through the verified event id', async () => {
    vi.resetModules();
    const eventUpdate = vi.fn().mockResolvedValue({ id: 'event-1' });
    const requireAdminEventAccess = vi.fn().mockResolvedValue({
      db: {
        event: {
          update: eventUpdate,
        },
      },
      event: { id: 'event-1', slug: 'intro-sail' },
      session: { user: { id: 'staff-1' } },
    });
    vi.doMock('@/libs/admin/events/eventAdminAuthorization', () => ({
      requireAdminEventAccess,
    }));
    vi.doMock('@/libs/DB', () => ({
      prisma: {
        event: {
          create: mocks.eventCreate,
          update: eventUpdate,
        },
      },
    }));
    const { updateAdminEventBasicsAction } =
      await import('@/libs/admin/events/eventAdminActions');

    await expect(
      updateAdminEventBasicsAction('en', 'intro-sail', validEventFormData())
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events/intro-sail/edit');

    expect(eventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'event-1' },
      })
    );
  });
});
