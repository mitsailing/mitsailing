import { healthNoStoreHeaders } from '@/libs/health/constants';
import { getLiveHealth } from '@/libs/health/live';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export function GET() {
  return Response.json(getLiveHealth(), { headers: healthNoStoreHeaders });
}

export function HEAD() {
  return new Response(null, { headers: healthNoStoreHeaders });
}
