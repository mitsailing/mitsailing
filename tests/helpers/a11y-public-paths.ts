import { staff, staffProfilePath } from '@/data/mit-sailing/aboutContent';
import { EVENTS } from '@/data/mit-sailing/eventsSeed';

/**
 * Public routes omitted from `/sitemap.xml` but worth scanning (auth shells,
 * donate, seeded event detail).
 */
const EXTRA_PATHS: string[] = [
  '/donate',
  '/login',
  '/signup',
  '/forgot-password',
  '/verify-email',
  '/unlock-account',
  ...staff.map((s) => staffProfilePath(s.slug)),
  ...EVENTS.filter(
    (e) =>
      e.is_published &&
      (e.detail_page_kind === undefined || e.detail_page_kind === 'standard')
  ).map((e) => `/events/${e.slug}`),
];

/**
 * Parses `<loc>` entries from sitemap XML and returns pathnames for the same
 * origin as `baseURL` (deduped, sorted).
 *
 * @param xml - Raw sitemap XML
 * @param baseURL - Site origin (e.g. `http://localhost:3008`)
 * @returns Pathnames for matching `<loc>` entries
 */
function pathsFromSitemapXml(xml: string, baseURL: string): string[] {
  const { origin } = new URL(baseURL);
  const paths = new Set<string>();
  const locRe = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null = locRe.exec(xml);
  while (m !== null) {
    const [, loc] = m;
    if (loc) {
      try {
        const u = new URL(loc);
        if (u.origin === origin) {
          paths.add(u.pathname || '/');
        }
      } catch {
        // ignore malformed loc
      }
    }
    m = locRe.exec(xml);
  }
  return [...paths];
}

/**
 * Builds the list of public marketing URLs to scan: live `/sitemap.xml` plus
 * curated extras (staff profiles, events, auth entry points, donate).
 *
 * @param baseURL - Playwright `use.baseURL` (no trailing slash)
 * @param sitemapXml - Raw `GET /sitemap.xml` body
 * @returns Sorted unique pathnames starting with `/`
 */
export function mergePublicA11yPaths(baseURL: string, sitemapXml: string) {
  const fromSitemap = pathsFromSitemapXml(sitemapXml, baseURL);
  const merged = new Set<string>([...fromSitemap, ...EXTRA_PATHS]);
  return [...merged].toSorted((a, b) => a.localeCompare(b));
}
