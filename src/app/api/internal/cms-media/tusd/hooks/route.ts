import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { handleCmsMediaTusHook } from '@/libs/mit-sailing/cmsMediaTusHooks';

export const runtime = 'nodejs';

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const secret = Env.MEDIA_UPLOAD_SHARED_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        HTTPResponse: {
          Body: JSON.stringify({ error: 'upload_service_not_configured' }),
          Header: {
            'Content-Type': 'application/json',
          },
          StatusCode: 503,
        },
        RejectUpload: true,
      },
      { status: 503 }
    );
  }

  const result = await handleCmsMediaTusHook({
    body: await requestBody(request),
    findAsset: async (assetId) => {
      const asset = await prisma.cmsMediaAsset.findUnique({
        select: {
          byteSize: true,
          id: true,
          mimeType: true,
          status: true,
          storageProvider: true,
          storedFilename: true,
        },
        where: { id: assetId },
      });
      return asset;
    },
    secret,
  });

  return NextResponse.json(result.body, { status: result.status });
}
