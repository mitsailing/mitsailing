import type { MetadataRoute } from 'next';
import { prisma } from '@/libs/DB';
import { routing } from '@/libs/I18nRouting';
import { getBaseUrl, getI18nPath } from '@/utils/Helpers';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getBaseUrl();

  const [classSlugs, boatSlugs] = await Promise.all([
    prisma.sailingClass.findMany({ select: { slug: true } }),
    prisma.fleetBoat.findMany({ select: { slug: true } }),
  ]);

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
