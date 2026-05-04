/**
 * Curated hero images for fleet marketing cards and detail pages. Prefer these
 * over `FleetBoat.imagePaths` until editorial uploads replace this map.
 */
export const UNSPLASH_BY_BOAT_SLUG: Record<string, string> = {
  'tech-dinghy':
    'https://images.unsplash.com/photo-1759809278956-70c6a72eecdd?w=1080',
  'flying-junior':
    'https://images.unsplash.com/photo-1660062436864-f7873d68df2d?w=1080',
  'club-420':
    'https://images.unsplash.com/photo-1776308786818-e498ccdb1cc4?w=1080',
};

const DEFAULT_FLEET_BOAT_HERO =
  'https://images.unsplash.com/photo-1577907073204-e5a8cbad51f5?w=1200';

/**
 * @param slug - Fleet boat slug from the database
 * @returns HTTPS image URL for marketing hero/gallery fallbacks
 */
export function getFleetBoatMarketingHeroSrc(slug: string): string {
  return UNSPLASH_BY_BOAT_SLUG[slug] ?? DEFAULT_FLEET_BOAT_HERO;
}
