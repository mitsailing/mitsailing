import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { routing } from '@/libs/I18nRouting';
import { logger } from '@/libs/Logger';
import { sitemapCatalogCacheTag } from '@/libs/mit-sailing/sitemapCache';
import { safeErrorCode, safeErrorName } from '@/libs/safeUnknownError';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

export { sitemapCatalogCacheTag };

/** Align with `Cache-Control` on `/sitemap.xml` in `next.config.ts` (CDN `s-maxage`). */
const SITEMAP_CATALOG_REVALIDATE_SECONDS = 86_400;

/**
 * - **No build-time DB:** Docker / `next build` have no Postgres → `force-dynamic`.
 * - **Origin load:** Prisma slug lists are wrapped in `unstable_cache` (24h TTL). After
 *   catalog or published-event changes: from a Server Action call `updateTag(sitemapCatalogCacheTag)`;
 *   from a route handler or cron, use `revalidateTag(sitemapCatalogCacheTag, 'max')`.
 * - **Edge traffic:** `next.config.ts` sets `s-maxage` so CDNs cache the XML response;
 *   a daily cron can `GET /sitemap.xml` to warm the edge after deploy (optional).
 */
export const dynamic = 'force-dynamic';

type SitemapSlugRow = { slug: string };

function logSitemapQueryFailure(options: {
  where: string;
  fallback: string;
  error: unknown;
}): void {
  const code = safeErrorCode(options.error);
  logger.error(
    [
      `[sitemap:${options.where}]`,
      `fallback=${options.fallback}`,
      `error_name=${safeErrorName(options.error)}`,
      code ? `error_code=${code}` : undefined,
    ]
      .filter((part): part is string => typeof part === 'string')
      .join(' ')
  );
}

function logSitemapEmptyFallback(options: {
  where: string;
  fallback: string;
  reason: string;
}): void {
  logger.warn(
    `[sitemap:${options.where}] fallback=${options.fallback} reason=${options.reason}`
  );
}

async function loadSitemapSlugRows(options: {
  where: string;
  load: () => Promise<SitemapSlugRow[]>;
}): Promise<SitemapSlugRow[]> {
  try {
    const rows = await options.load();
    if (rows.length === 0) {
      logSitemapEmptyFallback({
        where: options.where,
        fallback: 'static_routes_only',
        reason: 'empty_result',
      });
    }
    return rows;
  } catch (error) {
    logSitemapQueryFailure({
      where: options.where,
      fallback: 'empty_dynamic_routes',
      error,
    });
    return [];
  }
}

async function loadSitemapClassSlugs() {
  const rows = await prisma.sailingClass.findMany({
    where: { isVisible: true },
    select: { slug: true },
  });
  return rows;
}

async function loadSitemapBoatSlugs() {
  const rows = await prisma.fleetBoat.findMany({ select: { slug: true } });
  return rows;
}

async function loadSitemapEventSlugs() {
  const rows = await prisma.event.findMany({
    where: {
      isPublished: true,
      OR: [{ detailPageKind: 'standard' }, { detailPageKind: null }],
    },
    orderBy: { slug: 'asc' },
    select: { slug: true },
  });
  return rows;
}

const getSitemapClassSlugs = unstable_cache(
  loadSitemapClassSlugs,
  ['sitemap-class-slugs'],
  {
    revalidate: SITEMAP_CATALOG_REVALIDATE_SECONDS,
    tags: [sitemapCatalogCacheTag],
  }
);

const getSitemapBoatSlugs = unstable_cache(
  loadSitemapBoatSlugs,
  ['sitemap-boat-slugs'],
  {
    revalidate: SITEMAP_CATALOG_REVALIDATE_SECONDS,
    tags: [sitemapCatalogCacheTag],
  }
);

const getSitemapEventSlugs = unstable_cache(
  loadSitemapEventSlugs,
  ['sitemap-event-slugs'],
  {
    revalidate: SITEMAP_CATALOG_REVALIDATE_SECONDS,
    tags: [sitemapCatalogCacheTag],
  }
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();
  const slugLoaders =
    Env.IS_E2E === '1'
      ? {
          classes: loadSitemapClassSlugs,
          fleet: loadSitemapBoatSlugs,
          events: loadSitemapEventSlugs,
        }
      : {
          classes: getSitemapClassSlugs,
          fleet: getSitemapBoatSlugs,
          events: getSitemapEventSlugs,
        };

  const [classSlugs, boatSlugs, eventSlugs] = await Promise.all([
    loadSitemapSlugRows({
      where: 'classes',
      load: slugLoaders.classes,
    }),
    loadSitemapSlugRows({
      where: 'fleet',
      load: slugLoaders.fleet,
    }),
    loadSitemapSlugRows({
      where: 'events',
      load: slugLoaders.events,
    }),
  ]);

  const staticRoutes = [
    '',
    '/about',
    '/events',
    '/classes',
    '/ratings',
    '/fleet',
    '/pricing',
    '/alerts',
    '/contact',
    '/reserve',
    '/contact/mashnee-directions',
    '/privacy',
    '/terms',
    '/accessibility',
    '/about/mitna',
    '/about/mitna/constitution',
    '/about/mitna/meetings',
    '/about/mitna/hatch-award',
  ];

  const dynamicRoutes = [
    ...classSlugs.map((c) => `/classes/${c.slug}`),
    ...boatSlugs.map((b) => `/fleet/${b.slug}`),
    ...eventSlugs.map((e) => `/events/${e.slug}`),
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
