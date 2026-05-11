/**
 * Cache tag for slug lists consumed by `/sitemap.xml` (`unstable_cache` in `src/app/sitemap.ts`).
 *
 * - **Server Actions:** call `updateTag(sitemapCatalogCacheTag)` after mutations so tagged
 *   entries expire immediately ([Next.js: `updateTag`](https://nextjs.org/docs/app/api-reference/functions/updateTag)).
 * - **Route handlers / cron:** use `revalidateTag(sitemapCatalogCacheTag, 'max')` for stale-while-revalidate
 *   (`updateTag` cannot run outside Server Actions).
 */
export const sitemapCatalogCacheTag = 'sitemap-catalog';
