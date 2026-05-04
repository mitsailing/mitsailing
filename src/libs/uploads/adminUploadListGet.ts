import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/DB';
import { encodeAdminUploadListCursor } from '@/libs/uploads/adminUploadListCursor';
import type { AdminUploadListDecodedCursor } from '@/libs/uploads/adminUploadListCursor';

export const ADMIN_UPLOAD_LIST_DEFAULT_LIMIT = 24;
export const ADMIN_UPLOAD_LIST_MAX_LIMIT = 48;

/**
 * Parses the `limit` query param for GET /api/admin/uploads (clamped, positive).
 *
 * @param limitRaw - Raw `limit` search param or `null`
 * @returns Effective page size between 1 and {@link ADMIN_UPLOAD_LIST_MAX_LIMIT}
 */
export function parseUploadListLimitParam(limitRaw: string | null): number {
  let limit = ADMIN_UPLOAD_LIST_DEFAULT_LIMIT;
  if (limitRaw !== null && limitRaw !== '') {
    const parsed = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      limit = Math.min(parsed, ADMIN_UPLOAD_LIST_MAX_LIMIT);
    }
  }
  return limit;
}

/**
 * Builds the Prisma `where` clause for image-only admin upload listing with cursor pagination.
 *
 * @param cursor - Decoded cursor or `null` for the first page
 * @returns Prisma filter for `Upload` rows
 */
export function adminUploadImageListWhere(
  cursor: AdminUploadListDecodedCursor | null
): Prisma.UploadWhereInput {
  return {
    mimeType: { startsWith: 'image/' },
    ...(cursor
      ? {
          OR: [
            { createdAt: { lt: cursor.createdAt } },
            {
              createdAt: cursor.createdAt,
              id: { lt: cursor.id },
            },
          ],
        }
      : {}),
  };
}

export type AdminUploadListItemJson = {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

export type AdminUploadListPageJson = {
  items: AdminUploadListItemJson[];
  nextCursor: string | null;
};

/**
 * Loads one page of image uploads for the admin media library (newest first).
 *
 * @param limit - Page size (caller clamps via {@link parseUploadListLimitParam})
 * @param cursor - Decoded continuation cursor or `null`
 * @returns JSON-ready items and optional next cursor token
 */
export async function queryAdminUploadImageListPage(
  limit: number,
  cursor: AdminUploadListDecodedCursor | null
): Promise<AdminUploadListPageJson> {
  const where = adminUploadImageListWhere(cursor);

  const rows = await prisma.upload.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    select: {
      id: true,
      storageKey: true,
      mimeType: true,
      byteSize: true,
      createdAt: true,
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const last = page.at(-1);
  const nextCursor =
    hasMore && last
      ? encodeAdminUploadListCursor(last.createdAt, last.id)
      : null;

  return {
    items: page.map((u) => ({
      id: u.id,
      url: `/api/uploads/${u.storageKey}`,
      mimeType: u.mimeType,
      byteSize: u.byteSize,
      createdAt: u.createdAt.toISOString(),
    })),
    nextCursor,
  };
}
