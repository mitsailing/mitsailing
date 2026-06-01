import { NextResponse } from 'next/server';
import { listSailingClassesGroupedForCatalog } from '@/libs/mit-sailing/classQueries';
import { publicClassDetailUrl } from '@/libs/mit-sailing/publicDiscoveryUrls';

export const runtime = 'nodejs';

const cacheSeconds = 900;

type PublicClassCatalogSection = Awaited<
  ReturnType<typeof listSailingClassesGroupedForCatalog>
>[number];

function publicClassCategory(category: PublicClassCatalogSection['category']) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
  };
}

export async function GET() {
  const sections = await listSailingClassesGroupedForCatalog();
  const categories = sections.map((section) =>
    publicClassCategory(section.category)
  );
  const classes = sections.flatMap((section) =>
    section.classes.map((sailingClass) => ({
      id: sailingClass.id,
      name: sailingClass.name,
      slug: sailingClass.slug,
      level: sailingClass.level,
      description: sailingClass.description,
      category: publicClassCategory(section.category),
      detailUrl: publicClassDetailUrl(sailingClass.slug),
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
