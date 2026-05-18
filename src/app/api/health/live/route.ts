import { NextResponse } from 'next/server';
import { healthNoStoreHeaders } from '@/libs/health/constants';
import { getLiveHealth } from '@/libs/health/live';
import { safeConnection } from '@/libs/health/utils';

export const runtime = 'nodejs';

export async function GET() {
  await safeConnection();
  return NextResponse.json(getLiveHealth(), { headers: healthNoStoreHeaders });
}

export async function HEAD() {
  await safeConnection();
  return new NextResponse(null, { headers: healthNoStoreHeaders });
}
