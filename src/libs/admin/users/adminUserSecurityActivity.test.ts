import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE,
  listAdminUserSecurityActivityPage,
} from '@/libs/admin/users/adminUserSecurityActivity';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@/libs/DB', () => ({
  prisma: {
    auditLog: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
  },
}));

describe('listAdminUserSecurityActivityPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries AuditLog rows for the requested user only', async () => {
    mocks.count.mockResolvedValue(1);
    mocks.findMany.mockResolvedValue([
      {
        action: 'sign-in:email',
        createdAt: new Date('2026-05-08T16:30:00.000Z'),
        id: 'log-1',
        severity: 'medium',
        status: 'success',
      },
    ]);

    await expect(
      listAdminUserSecurityActivityPage({ page: 1, userId: 'user-1' })
    ).resolves.toEqual({
      page: 1,
      pageSize: ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE,
      rows: [
        {
          action: 'sign-in:email',
          createdAt: new Date('2026-05-08T16:30:00.000Z'),
          id: 'log-1',
          severity: 'medium',
          status: 'success',
        },
      ],
      total: 1,
    });

    expect(mocks.count).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(mocks.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        id: true,
        severity: true,
        status: true,
      },
      skip: 0,
      take: ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE,
      where: { userId: 'user-1' },
    });
  });

  it('clamps the page to the available range', async () => {
    mocks.count.mockResolvedValue(2);
    mocks.findMany.mockResolvedValue([]);

    await expect(
      listAdminUserSecurityActivityPage({
        page: 99,
        pageSize: 1,
        userId: 'user-1',
      })
    ).resolves.toMatchObject({
      page: 2,
      pageSize: 1,
      total: 2,
    });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 1,
        take: 1,
      })
    );
  });
});
