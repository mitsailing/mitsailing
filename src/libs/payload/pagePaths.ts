/**
 * Normalizes a Payload page slug into a public path with a leading slash.
 *
 * @param slug - Page slug as stored in Payload (with or without leading slash)
 * @returns Public path including leading slash
 */
export function publicPathFromPageSlug(slug: string): string {
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    return '/';
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Builds slug lookup values for a catch-all CMS path.
 *
 * @param segments - Path segments from `[...cmsPath]`
 * @returns Slug variants with and without a leading slash
 */
export function pageSlugVariantsFromSegments(segments: string[]): string[] {
  const joined = segments.join('/');
  const withSlash = `/${joined}`;
  return joined.startsWith('/')
    ? [joined, joined.slice(1)]
    : [joined, withSlash];
}
