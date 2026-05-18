import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  eventCount: vi.fn(),
  eventFindFirst: vi.fn(),
  listRolePermissionGrants: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireAnyPermission: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  requireAnyPermission: mocks.requireAnyPermission,
}));

vi.mock('@/libs/auth/rolePermissionGrants', () => ({
  listRolePermissionGrants: mocks.listRolePermissionGrants,
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    event: {
      count: mocks.eventCount,
      findFirst: mocks.eventFindFirst,
    },
  },
}));

vi.mock('@/utils/Helpers', () => ({
  getI18nPath: (path: string) => path,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.eventFindFirst.mockReset();
  mocks.eventCount.mockReset();
  mocks.listRolePermissionGrants.mockReset();
  mocks.redirect.mockClear();
  mocks.requireAnyPermission.mockReset();
  mocks.requireAnyPermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: { id: 'staff-1', role: Role.DOCK_STAFF },
  });
  mocks.listRolePermissionGrants.mockResolvedValue([
    { permissionKey: Permission.EVENTS_MANAGE, roleKey: Role.DOCK_STAFF },
  ]);
  mocks.eventCount.mockResolvedValue(1);
});

function mockEvent(props: {
  admins: readonly {
    adminUserId: string;
  }[];
  createdByUserId: string;
}) {
  mocks.eventFindFirst.mockResolvedValue({
    id: 'event-1',
    slug: 'intro-sail',
    createdByUserId: props.createdByUserId,
    admins: props.admins,
  });
}

describe('requireAdminEventAccess', () => {
  it('allows dock staff to edit any event', async () => {
    mockEvent({
      admins: [],
      createdByUserId: 'creator-1',
    });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'intro-sail',
    });

    expect(access?.event.id).toBe('event-1');
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { AND: [{ slug: 'intro-sail' }, {}] },
      })
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows assigned volunteer instructors to edit the event', async () => {
    mocks.requireAnyPermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'staff-1', role: Role.VOLUNTEER_INSTRUCTOR },
    });
    mocks.listRolePermissionGrants.mockResolvedValue([
      {
        permissionKey: Permission.EVENTS_CREATE,
        roleKey: Role.VOLUNTEER_INSTRUCTOR,
      },
    ]);
    mockEvent({
      admins: [{ adminUserId: 'staff-1' }, { adminUserId: 'staff-2' }],
      createdByUserId: 'creator-1',
    });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'intro-sail',
    });

    expect(access?.event.id).toBe('event-1');
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { slug: 'intro-sail' },
            {
              OR: [{ admins: { some: { adminUserId: 'staff-1' } } }],
            },
          ],
        },
      })
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('does not let volunteer instructor creators edit unassigned events', async () => {
    mocks.requireAnyPermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'staff-1', role: Role.VOLUNTEER_INSTRUCTOR },
    });
    mocks.listRolePermissionGrants.mockResolvedValue([
      {
        permissionKey: Permission.EVENTS_CREATE,
        roleKey: Role.VOLUNTEER_INSTRUCTOR,
      },
    ]);
    mocks.eventFindFirst.mockResolvedValue(null);
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    await expect(
      requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' })
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events');
    expect(mocks.eventFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { slug: 'intro-sail' },
            {
              OR: [{ admins: { some: { adminUserId: 'staff-1' } } }],
            },
          ],
        },
      })
    );
  });

  it('redirects event admins away from unrelated events', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    await expect(
      requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' })
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events');
  });

  it('returns null when the event does not exist', async () => {
    mocks.eventFindFirst.mockResolvedValue(null);
    mocks.eventCount.mockResolvedValue(0);
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'missing-event',
    });

    expect(access).toBeNull();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows site admins to edit any event', async () => {
    mocks.requireAnyPermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { id: 'admin-1', role: Role.ADMIN },
    });
    mockEvent({ admins: [], createdByUserId: 'creator-1' });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'intro-sail',
    });

    expect(access?.event.id).toBe('event-1');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
