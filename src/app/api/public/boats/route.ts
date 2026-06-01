import { NextResponse } from 'next/server';
import { listFleetBoatsForPublic } from '@/libs/mit-sailing/fleetQueries';
import { publicFleetBoatDetailUrl } from '@/libs/mit-sailing/publicDiscoveryUrls';

export const runtime = 'nodejs';

const cacheSeconds = 900;

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
        detailUrl: publicFleetBoatDetailUrl(boat.slug),
      })),
    },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    }
  );
}
