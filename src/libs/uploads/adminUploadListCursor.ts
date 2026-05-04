/**
 * Opaque cursor for GET /api/admin/uploads pagination (createdAt desc, id desc).
 */

const SEP = '\u001F';

/**
 * Encodes the last row of the previous page for the next request.
 *
 * @param createdAt - Row `createdAt`
 * @param id - Row `id`
 * @returns Base64url string safe for query params
 */
export function encodeAdminUploadListCursor(
  createdAt: Date,
  id: string
): string {
  const payload = `${createdAt.toISOString()}${SEP}${id}`;
  return Buffer.from(payload, 'utf8').toString('base64url');
}

/**
 * Decoded opaque cursor for GET /api/admin/uploads pagination.
 */
export type AdminUploadListDecodedCursor = {
  createdAt: Date;
  id: string;
};

/**
 * Decodes a cursor from the list endpoint query string.
 *
 * @param cursor - Raw `cursor` query value
 * @returns Parsed tuple or `null` when invalid
 */
export function decodeAdminUploadListCursor(
  cursor: string
): AdminUploadListDecodedCursor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8');
    const i = raw.indexOf(SEP);
    if (i === -1) {
      return null;
    }
    const iso = raw.slice(0, i);
    const id = raw.slice(i + SEP.length);
    if (id.length === 0) {
      return null;
    }
    const createdAt = new Date(iso);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }
    return { createdAt, id };
  } catch {
    return null;
  }
}
