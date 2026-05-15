import { connection } from 'next/server';
import { healthNoStoreHeaders } from '@/libs/health/constants';
import { getLiveHealth } from '@/libs/health/live';

export const runtime = 'nodejs';

async function safeConnection(): Promise<void> {
  try {
    await connection();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('outside a request scope')) {
      return;
    }
    throw error;
  }
}

export async function GET() {
  await safeConnection();
  return Response.json(getLiveHealth(), { headers: healthNoStoreHeaders });
}

export async function HEAD() {
  await safeConnection();
  return new Response(null, { headers: healthNoStoreHeaders });
}
