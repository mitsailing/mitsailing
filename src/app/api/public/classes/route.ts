import { NextResponse } from 'next/server';
import { listSailingClassesGroupedForCatalog } from '@/libs/mit-sailing/classQueries';
import { MIT_SAILING_PUBLIC_ORIGIN } from '@/libs/mit-sailing/publicDiscoveryUrls';
import { AppConfig } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';

export const runtime = 'nodejs';

const cacheSeconds = 900;

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function classPath(slug: string): string {
  return getI18nPath(
    `/classes/${encodeURIComponent(slug)}`,
    AppConfig.i18n.defaultLocale
  );
}

export async function GET() {
  const sections = await listSailingClassesGroupedForCatalog();
  const categories = sections.map((section) => ({
    id: section.category.id,
    name: section.category.name,
    slug: section.category.slug,
  }));
  const classes = sections.flatMap((section) =>
    section.classes.map((sailingClass) => ({
      id: sailingClass.id,
      name: sailingClass.name,
      slug: sailingClass.slug,
      level: sailingClass.level,
      description: sailingClass.description,
      category: {
        id: section.category.id,
        name: section.category.name,
        slug: section.category.slug,
      },
      detailUrl: absoluteUrl(
        MIT_SAILING_PUBLIC_ORIGIN,
        classPath(sailingClass.slug)
      ),
    }))
  );
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      cacheSeconds,
      categories,
      classes,
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    }
  );
}
