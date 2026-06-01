import { NextResponse } from 'next/server';
import { publicAiDiscoveryUrl } from '@/libs/mit-sailing/publicDiscoveryUrls';

export function GET() {
  return NextResponse.redirect(publicAiDiscoveryUrl());
}
