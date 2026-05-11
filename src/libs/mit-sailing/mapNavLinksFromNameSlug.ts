/** Minimal shape for `{ label, href }[]` dropdown rows keyed by slug. */
export type NameSlugNavSource = Pick<
  { name: string; slug: string },
  'name' | 'slug'
>;

/**
 * @param rows - Pre-sorted rows (caller’s query defines order)
 * @param hrefForSlug - Slug-only href builder (`/classes#…` vs `/fleet/…`)
 * @returns `{ label, href }` pairs in the same order as `rows`
 */
export function mapNameSlugRowsToNavLinks(
  rows: readonly NameSlugNavSource[],
  hrefForSlug: (slug: string) => string
): { label: string; href: string }[] {
  return rows.map((row) => ({
    label: row.name,
    href: hrefForSlug(row.slug),
  }));
}

/**
 * Classes dropdown: anchored category sections.
 *
 * @param slug - Category slug for the `#` fragment.
 * @returns Path to `/classes` with slug hash.
 */
export function hrefClassesCategoryFromSlug(slug: string) {
  return `/classes#${encodeURIComponent(slug)}`;
}

/**
 * Fleet dropdown and list paths.
 *
 * @param slug - Fleet boat slug.
 * @returns Canonical fleet detail URL.
 */
export function hrefFleetBoatFromSlug(slug: string) {
  return `/fleet/${encodeURIComponent(slug)}`;
}
