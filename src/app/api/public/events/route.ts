import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { listPublicEventsForDiscovery } from '@/libs/mit-sailing/publicEventDiscovery';

export const runtime = 'nodejs';

const defaultLimit = 20;
const maxLimit = 50;

function singleSearchParam(
  params: URLSearchParams,
  key: string
): string | undefined {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : undefined;
}

function publicEventsLimit(params: URLSearchParams): number {
  const raw = params.get('limit');
  const value = raw ? Number(raw) : defaultLimit;
  if (!Number.isInteger(value)) {
    return defaultLimit;
  }
  return Math.min(maxLimit, Math.max(1, value));
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const discovery = await listPublicEventsForDiscovery({
    category: singleSearchParam(searchParams, 'category'),
    limit: publicEventsLimit(searchParams),
    query: singleSearchParam(searchParams, 'query'),
  });
  return NextResponse.json(discovery, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  });
}
