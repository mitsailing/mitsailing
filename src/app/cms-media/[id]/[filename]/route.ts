import { NextResponse } from 'next/server';
import { prisma } from '@/libs/DB';
import { readCmsMediaFile } from '@/libs/mit-sailing/cmsMediaStorage';
import {
  buildCmsMediaPublicPath,
  CMS_MEDIA_ALLOWED_MIME_TYPES,
} from '@/libs/mit-sailing/cmsMediaValidation';

export const runtime = 'nodejs';

type CmsMediaRouteProps = {
  params: Promise<{ id: string; filename: string }>;
};

type CmsMediaAssetRouteRecord = {
  storedFilename: string;
  mimeType: string;
  publicPath: string;
} | null;

const CMS_MEDIA_RESPONSE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Content-Security-Policy':
    "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'none'; script-src 'none'; sandbox",
  'X-Content-Type-Options': 'nosniff',
} as const;

const cmsMediaAllowedMimeTypes = new Set<string>(CMS_MEDIA_ALLOWED_MIME_TYPES);

function cmsMediaContentType(mimeType: string): string {
  return cmsMediaAllowedMimeTypes.has(mimeType)
    ? mimeType
    : 'application/octet-stream';
}

/**
 * Serves only DB-known CMS media files from the configured storage root.
 *
 * @param _request - Incoming request
 * @param props - Route params from `/cms-media/:id/:filename`
 * @returns Image response or 404
 */
export async function GET(_request: Request, props: CmsMediaRouteProps) {
  const { id, filename } = await props.params;
  let asset: CmsMediaAssetRouteRecord;
  try {
    asset = await prisma.cmsMediaAsset.findUnique({
      where: { id },
      select: {
        storedFilename: true,
        mimeType: true,
        publicPath: true,
      },
    });
  } catch (error: unknown) {
    console.error('Failed to fetch CMS media asset', error);
    return new NextResponse(null, { status: 500 });
  }

  if (
    !asset ||
    asset.storedFilename !== filename ||
    asset.publicPath !== buildCmsMediaPublicPath({ id, filename })
  ) {
    return new NextResponse(null, { status: 404 });
  }

  let bytes: Awaited<ReturnType<typeof readCmsMediaFile>>;
  try {
    bytes = await readCmsMediaFile({ id, filename });
  } catch (error: unknown) {
    console.error('Failed to read CMS media file', error);
    return new NextResponse(null, { status: 500 });
  }
  if (!bytes) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      ...CMS_MEDIA_RESPONSE_HEADERS,
      'Content-Length': String(bytes.byteLength),
      'Content-Type': cmsMediaContentType(asset.mimeType),
    },
  });
}
