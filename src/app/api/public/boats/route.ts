import { NextResponse } from 'next/server';
import { listFleetBoatsForPublic } from '@/libs/mit-sailing/fleetQueries';
import { MIT_SAILING_PUBLIC_ORIGIN } from '@/libs/mit-sailing/publicDiscoveryUrls';
import { AppConfig } from '@/utils/AppConfig';
import { getI18nPath } from '@/utils/Helpers';

export const runtime = 'nodejs';

const cacheSeconds = 900;

function absoluteUrl(origin: string, path: string): string {
  return new URL(path, origin).toString();
}

function fleetBoatPath(slug: string): string {
  return getI18nPath(
    `/fleet/${encodeURIComponent(slug)}`,
    AppConfig.i18n.defaultLocale
  );
}

export async function GET() {
  const boats = await listFleetBoatsForPublic();
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      cacheSeconds,
      boats: boats.map((boat) => ({
        id: boat.id,
        name: boat.name,
        slug: boat.slug,
        type: boat.type,
        capacity: boat.capacity,
        description: boat.description,
        requiredClass: {
          name: boat.requiredClass.name,
          slug: boat.requiredClass.slug,
        },
        requiredRatings: boat.requiredRatings.map((rating) => ({
          id: rating.id,
          name: rating.name,
          shortName: rating.shortName,
          slug: rating.slug,
        })),
        detailUrl: absoluteUrl(
          MIT_SAILING_PUBLIC_ORIGIN,
          fleetBoatPath(boat.slug)
        ),
      })),
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    }
  );
}
