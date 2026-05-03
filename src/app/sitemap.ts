import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/libs/DB';
import { routing } from '@/libs/I18nRouting';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

/** Align with `Cache-Control` on `/sitemap.xml` in `next.config.ts` (CDN `s-maxage`). */
const SITEMAP_CATALOG_REVALIDATE_SECONDS = 86_400;

/** Use with `revalidateTag` from Server Actions or a secured cron route after catalog edits. */
export const sitemapCatalogCacheTag = 'sitemap-catalog';

/**
 * - **No build-time DB:** Docker / `next build` have no Postgres → `force-dynamic`.
 * - **Origin load:** Prisma slug lists are wrapped in `unstable_cache` (24h TTL). After
 *   admin edits to classes/fleet, call `revalidateTag('sitemap-catalog')` from a
 *   Server Action or a secured cron route (`revalidateTag(sitemapCatalogCacheTag)`).
 * - **Edge traffic:** `next.config.ts` sets `s-maxage` so CDNs cache the XML response;
 *   a daily cron can `GET /sitemap.xml` to warm the edge after deploy (optional).
 */
export const dynamic = 'force-dynamic';

const getCatalogSlugs = unstable_cache(
  async () => {
    const [classes, boats] = await Promise.all([
      prisma.sailingClass.findMany({
        where: { isVisible: true },
        select: { slug: true },
      }),
      prisma.fleetBoat.findMany({ select: { slug: true } }),
    ]);
    return [classes, boats] as const;
  },
  ['sitemap-catalog-slugs'],
  {
    revalidate: SITEMAP_CATALOG_REVALIDATE_SECONDS,
    tags: [sitemapCatalogCacheTag],
  }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const [classSlugs, boatSlugs] = await getCatalogSlugs();

  const staticRoutes = [
    '',
    '/about',
    '/events',
    '/classes',
    '/fleet',
    '/contact',
    '/contact/mashnee-directions',
    '/about/mitna',
    '/about/mitna/constitution',
    '/about/mitna/meetings',
    '/about/mitna/hatch-award',
  ];

  const dynamicRoutes = [
    ...classSlugs.map((c) => `/classes/${c.slug}`),
    ...boatSlugs.map((b) => `/fleet/${b.slug}`),
  ];

  const allRoutes = [...staticRoutes, ...dynamicRoutes];

  return allRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    alternates: {
      languages: Object.fromEntries(
        routing.locales
          .filter((locale) => locale !== routing.defaultLocale)
          .map((locale) => [locale, `${baseUrl}${getI18nPath(route, locale)}`])
      ),
    },
  }));
}
