/**
 * Extracts a non-empty slug from a catalog revision snapshot.
 *
 * @param snapshot - Revision snapshot with an optional slug property
 * @returns The slug, or null when the snapshot shape or slug is invalid
 */
export function snapshotSlug(snapshot: unknown): string | null {
  if (
    typeof snapshot !== 'object' ||
    snapshot === null ||
    Array.isArray(snapshot)
  ) {
    return null;
  }
  const slug = Object.getOwnPropertyDescriptor(snapshot, 'slug')?.value;
  return typeof slug === 'string' && slug.trim().length > 0 ? slug : null;
}
