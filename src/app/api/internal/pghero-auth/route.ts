import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/libs/auth/dal';
import { Role } from '@/libs/auth/roles';

export const runtime = 'nodejs';

async function authorizePgHeroAdmin(): Promise<NextResponse> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return new NextResponse(null, {
      headers: { 'Cache-Control': 'no-store' },
      status: 401,
    });
  }
  if (currentUser.role !== Role.ADMIN) {
    return new NextResponse(null, {
      headers: { 'Cache-Control': 'no-store' },
      status: 403,
    });
  }
  return new NextResponse(null, {
    headers: { 'Cache-Control': 'no-store' },
    status: 204,
  });
}

export const GET = authorizePgHeroAdmin;
export const HEAD = authorizePgHeroAdmin;
export const POST = authorizePgHeroAdmin;
