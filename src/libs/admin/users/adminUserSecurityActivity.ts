import 'server-only';
import { prisma } from '@/libs/DB';

const ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE = 25;

export type AdminUserSecurityActivityRow = {
  readonly action: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly severity: string;
  readonly status: string;
};

export type AdminUserSecurityActivityPage = {
  readonly page: number;
  readonly pageSize: number;
  readonly rows: AdminUserSecurityActivityRow[];
  readonly total: number;
};

/**
 * Lists Better Auth `AuditLog` rows for one user. Scoped by `userId` so the
 * admin page never dumps every auth event.
 *
 * @param options - User id and 1-based page
 * @returns Paginated auth-event rows for that user
 */
export async function listAdminUserSecurityActivityPage(options: {
  readonly page: number;
  readonly pageSize?: number;
  readonly userId: string;
}): Promise<AdminUserSecurityActivityPage> {
  const pageSize = options.pageSize ?? ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE;
  const where = { userId: options.userId };
  const total = await prisma.auditLog.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(options.page, 1), totalPages);
  const rows = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      action: true,
      createdAt: true,
      id: true,
      severity: true,
      status: true,
    },
    skip: (page - 1) * pageSize,
    take: pageSize,
    where,
  });

  return {
    page,
    pageSize,
    rows,
    total,
  };
}

export { ADMIN_USER_SECURITY_ACTIVITY_PAGE_SIZE };
