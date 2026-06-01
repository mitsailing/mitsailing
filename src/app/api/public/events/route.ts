import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  listPublicEventsForDiscovery,
  publicEventLimit,
} from '@/libs/mit-sailing/publicEventDiscovery';

export const runtime = 'nodejs';

const cacheSeconds = 300;

function singleSearchParam(
  params: URLSearchParams,
  key: string
): string | undefined {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : undefined;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawLimit = searchParams.get('limit');
  const discovery = await listPublicEventsForDiscovery({
    category: singleSearchParam(searchParams, 'category'),
    limit: publicEventLimit(rawLimit ? Number(rawLimit) : undefined),
    query: singleSearchParam(searchParams, 'query'),
  });
  return NextResponse.json(
    { ...discovery, cacheSeconds },
    {
      headers: {
        'Cache-Control': `public, s-maxage=${cacheSeconds}, stale-while-revalidate=600`,
      },
    }
  );
}
