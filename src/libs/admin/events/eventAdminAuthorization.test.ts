import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  eventCount: vi.fn(),
  eventFindFirst: vi.fn(),
  appAuthContextFromSession: vi.fn(),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
  requireAdmin: vi.fn(),
  zenstackForAuthContext: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/auth/dal', () => ({
  appRoleFromSessionUser: (user: { appRole?: unknown }) => user.appRole,
  requireAdmin: mocks.requireAdmin,
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
  mocks.appAuthContextFromSession.mockReset();
  mocks.redirect.mockClear();
  mocks.requireAdmin.mockReset();
  mocks.zenstackForAuthContext.mockReset();
  const session = {
    session: { impersonatedBy: null },
    user: { appRole: Role.DOCK_STAFF, id: 'staff-1', role: Role.USER },
  };
  mocks.requireAdmin.mockResolvedValue(session);
  mocks.appAuthContextFromSession.mockReturnValue({
    appRole: Role.DOCK_STAFF,
    id: 'staff-1',
  });
  mocks.zenstackForAuthContext.mockReturnValue({
    event: {
      findFirst: mocks.eventFindFirst,
    },
  });
  mocks.eventCount.mockResolvedValue(1);
});

function mockEvent(props: {
  admins: readonly {
    adminUserId: string;
  }[];
}) {
  mocks.eventFindFirst.mockResolvedValue({
    id: 'event-1',
    slug: 'intro-sail',
    admins: props.admins,
  });
}

describe('requireAdminEventAccess', () => {
  it('allows dock staff to edit any event', async () => {
    mockEvent({
      admins: [],
    });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'intro-sail',
    });

    expect(access?.event.id).toBe('event-1');
    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: Role.DOCK_STAFF,
      id: 'staff-1',
    });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('allows assigned volunteer instructors to edit their events', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.VOLUNTEER_INSTRUCTOR,
        id: 'staff-1',
        role: Role.DOCK_STAFF,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.VOLUNTEER_INSTRUCTOR,
      id: 'staff-1',
    });
    mockEvent({
      admins: [{ adminUserId: 'staff-1' }, { adminUserId: 'staff-2' }],
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
        where: { slug: 'intro-sail' },
      })
    );
  });

  it('does not let unassigned volunteer instructors edit events', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.VOLUNTEER_INSTRUCTOR,
        id: 'staff-1',
        role: Role.DOCK_STAFF,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.VOLUNTEER_INSTRUCTOR,
      id: 'staff-1',
    });
    mockEvent({ admins: [] });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    await expect(
      requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' })
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events');
    expect(mocks.zenstackForAuthContext).toHaveBeenCalledWith({
      appRole: Role.VOLUNTEER_INSTRUCTOR,
      id: 'staff-1',
    });
  });

  it('allows unassigned volunteer instructors to read events', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.VOLUNTEER_INSTRUCTOR,
        id: 'staff-1',
        role: Role.USER,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.VOLUNTEER_INSTRUCTOR,
      id: 'staff-1',
    });
    mockEvent({ admins: [] });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      minimumAccessMode: 'readOnly',
      slug: 'intro-sail',
    });

    expect(access?.accessMode).toBe('readOnly');
    expect(access?.event.id).toBe('event-1');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('does not treat public event read access as edit access', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.VOLUNTEER_INSTRUCTOR,
        id: 'staff-1',
        role: Role.USER,
      },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.VOLUNTEER_INSTRUCTOR,
      id: 'staff-1',
    });
    mockEvent({ admins: [] });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    await expect(
      requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' })
    ).rejects.toThrow('NEXT_REDIRECT:/admin/events');

    expect(mocks.eventFindFirst).toHaveBeenCalled();
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
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { appRole: Role.ADMIN, id: 'admin-1', role: Role.USER },
    });
    mocks.appAuthContextFromSession.mockReturnValue({
      appRole: Role.ADMIN,
      id: 'admin-1',
    });
    mockEvent({ admins: [] });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventAccess({
      locale: 'en',
      slug: 'intro-sail',
    });

    expect(access?.accessMode).toBe('editable');
    expect(access?.event.id).toBe('event-1');
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('requires admin access before loading scoped events', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { appRole: Role.DOCK_STAFF, id: 'staff-1', role: Role.USER },
    });
    mockEvent({
      admins: [{ adminUserId: 'staff-1' }],
    });
    const { requireAdminEventAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    await requireAdminEventAccess({ locale: 'en', slug: 'intro-sail' });

    expect(mocks.requireAdmin).toHaveBeenCalledWith('en');
  });

  it('exposes a reusable ZenStack client for list queries', async () => {
    mocks.requireAdmin.mockResolvedValue({
      session: { impersonatedBy: null },
      user: { appRole: Role.DOCK_STAFF, id: 'staff-1', role: Role.USER },
    });
    const { requireAdminEventListAccess } =
      await import('@/libs/admin/events/eventAdminAuthorization');

    const access = await requireAdminEventListAccess('en');

    expect(access.db).toEqual({
      event: {
        findFirst: mocks.eventFindFirst,
      },
    });
    expect(access.authContext).toEqual({
      appRole: Role.DOCK_STAFF,
      id: 'staff-1',
    });
  });
});
