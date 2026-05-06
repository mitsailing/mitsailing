export type AdminUploadListItem = {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  createdAt: string;
};

function isAdminUploadImageUrl(url: string): boolean {
  return url.startsWith('/api/uploads/');
}

export function parseAdminUploadListResponse(parsed: unknown): {
  items: AdminUploadListItem[];
  nextCursor: string | null;
} | null {
  if (typeof parsed !== 'object' || parsed === null) {
    return null;
  }
  const itemsRaw = Reflect.get(parsed, 'items');
  const nextCursorRaw = Reflect.get(parsed, 'nextCursor');
  if (!Array.isArray(itemsRaw)) {
    return null;
  }
  const items: AdminUploadListItem[] = [];
  for (const row of itemsRaw) {
    if (typeof row !== 'object' || row === null) {
      return null;
    }
    const id = Reflect.get(row, 'id');
    const url = Reflect.get(row, 'url');
    const mimeType = Reflect.get(row, 'mimeType');
    const byteSize = Reflect.get(row, 'byteSize');
    const createdAt = Reflect.get(row, 'createdAt');
    if (
      typeof id !== 'string' ||
      typeof url !== 'string' ||
      !isAdminUploadImageUrl(url) ||
      typeof mimeType !== 'string' ||
      !mimeType.startsWith('image/') ||
      typeof byteSize !== 'number' ||
      typeof createdAt !== 'string'
    ) {
      return null;
    }
    items.push({ id, url, mimeType, byteSize, createdAt });
  }
  let nextCursor: string | null = null;
  if (nextCursorRaw === undefined || nextCursorRaw === null) {
    nextCursor = null;
  } else if (typeof nextCursorRaw === 'string') {
    nextCursor = nextCursorRaw;
  } else {
    return null;
  }
  return { items, nextCursor };
}

/**
 * Fetches a page of admin uploads for the media library picker.
 *
 * @param cursor - Continuation cursor or `null` for the first page
 * @returns Parsed items and next cursor, or `null` on HTTP or parse failure
 */
export async function fetchAdminUploadListPage(cursor: string | null): Promise<{
  items: AdminUploadListItem[];
  nextCursor: string | null;
} | null> {
  const params = new URLSearchParams();
  params.set('limit', '24');
  if (cursor !== null) {
    params.set('cursor', cursor);
  }
  const res = await fetch(`/api/admin/uploads?${params}`, {
    credentials: 'include',
  });
  if (!res.ok) {
    return null;
  }
  const parsed: unknown = await res.json();
  return parseAdminUploadListResponse(parsed);
}
