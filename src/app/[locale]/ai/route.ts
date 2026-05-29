import { NextResponse } from 'next/server';
import { MIT_SAILING_PUBLIC_ORIGIN } from '@/libs/mit-sailing/publicDiscoveryUrls';

export function GET() {
  return NextResponse.redirect(new URL('/llm.txt', MIT_SAILING_PUBLIC_ORIGIN));
}
