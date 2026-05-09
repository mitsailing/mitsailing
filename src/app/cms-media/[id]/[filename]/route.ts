import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { readCmsMediaFile } from '@/libs/mit-sailing/cmsMediaStorage';

type CmsMediaRouteProps = {
  params: Promise<{ id: string; filename: string }>;
};

const CMS_MEDIA_RESPONSE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
} as const;

/**
 * Serves only DB-known CMS media files from the configured storage root.
 *
 * @param _request - Incoming request
 * @param props - Route params from `/cms-media/:id/:filename`
 * @returns Image response or 404
 */
export async function GET(_request: Request, props: CmsMediaRouteProps) {
  const { id, filename } = await props.params;
  const asset = await prisma.cmsMediaAsset.findUnique({
    where: { id },
    select: {
      storedFilename: true,
      mimeType: true,
      publicPath: true,
    },
  });

  if (
    !asset ||
    asset.storedFilename !== filename ||
    asset.publicPath !== `/cms-media/${id}/${filename}`
  ) {
    return new NextResponse(null, { status: 404 });
  }

  const bytes = await readCmsMediaFile({ id, filename });
  if (!bytes) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...CMS_MEDIA_RESPONSE_HEADERS,
      'Content-Length': String(bytes.byteLength),
      'Content-Type': asset.mimeType,
    },
  });
}
