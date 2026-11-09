import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  buildCmsMediaPublicPath,
  detectCmsMediaHeicMimeType,
  detectCmsMediaMimeType,
  normalizeCmsMediaDeclaredMimeType,
  sanitizeCmsMediaFilename,
} from '@/libs/mit-sailing/cmsMediaValidation';

const CMS_MEDIA_IMAGE_MAX_LONG_SIDE = 2560;

export type CmsMediaProcessedImage = {
  byteSize: number;
  bytes: Uint8Array;
  mimeType: 'image/gif' | 'image/jpeg' | 'image/png' | 'image/webp';
  storedFilename: string;
};

function jpegStoredFilename(originalFilename: string) {
  return sanitizeCmsMediaFilename(originalFilename, 'image/jpeg');
}

/**
 * Resizes and orients an uploaded CMS image, converting HEIC/HEIF to JPEG.
 *
 * @param props - Raw image bytes and original upload metadata.
 * @returns Processed image bytes and final storage metadata.
 */
export async function processCmsMediaImageBytes(props: {
  bytes: Uint8Array;
  mimeType: string;
  originalFilename: string;
}): Promise<CmsMediaProcessedImage> {
  const declared = normalizeCmsMediaDeclaredMimeType(props.mimeType);
  const detected = detectCmsMediaMimeType(props.bytes);
  const detectedHeic = detectCmsMediaHeicMimeType(props.bytes);

  if (detectedHeic || declared === 'image/heic' || declared === 'image/heif') {
    if (!detectedHeic) {
      throw new Error('CMS media HEIC signature mismatch');
    }
    const output = await sharp(props.bytes, { failOn: 'none' })
      .rotate()
      .resize({
        fit: 'inside',
        height: CMS_MEDIA_IMAGE_MAX_LONG_SIDE,
        withoutEnlargement: true,
        width: CMS_MEDIA_IMAGE_MAX_LONG_SIDE,
      })
      .jpeg({ mozjpeg: true, quality: 85 })
      .toBuffer();
    const storedFilename = jpegStoredFilename(props.originalFilename);
    return {
      byteSize: output.byteLength,
      bytes: new Uint8Array(output),
      mimeType: 'image/jpeg',
      storedFilename,
    };
  }

  if (!detected) {
    throw new Error('CMS media image signature mismatch');
  }
  if (
    declared.length > 0 &&
    declared !== detected &&
    !(declared === 'image/jpeg' && detected === 'image/jpeg')
  ) {
    throw new Error('CMS media image MIME mismatch');
  }

  const pipeline = sharp(props.bytes, {
    animated: detected === 'image/gif',
    failOn: 'none',
  })
    .rotate()
    .resize({
      fit: 'inside',
      height: CMS_MEDIA_IMAGE_MAX_LONG_SIDE,
      withoutEnlargement: true,
      width: CMS_MEDIA_IMAGE_MAX_LONG_SIDE,
    });

  let output: Buffer;
  if (detected === 'image/png') {
    output = await pipeline.png().toBuffer();
  } else if (detected === 'image/webp') {
    output = await pipeline.webp().toBuffer();
  } else if (detected === 'image/gif') {
    output = await pipeline.gif().toBuffer();
  } else {
    output = await pipeline.jpeg({ mozjpeg: true, quality: 85 }).toBuffer();
  }

  return {
    byteSize: output.byteLength,
    bytes: new Uint8Array(output),
    mimeType: detected,
    storedFilename: sanitizeCmsMediaFilename(props.originalFilename, detected),
  };
}

/**
 * Writes a processed CMS image to the ready path, replacing HEIC names with JPEG.
 *
 * @param props - Asset identifiers and filesystem paths around the ready file.
 * @returns Final ready-file metadata after processing.
 */
export async function writeProcessedCmsMediaImage(props: {
  assetId: string;
  mimeType: string;
  originalFilename: string;
  readyPath: string;
  sourcePath: string;
}): Promise<{
  byteSize: number;
  mimeType: CmsMediaProcessedImage['mimeType'];
  publicPath: string;
  readyFilePath: string;
  storedFilename: string;
}> {
  const sourceBytes = new Uint8Array(await readFile(props.sourcePath));
  const processed = await processCmsMediaImageBytes({
    bytes: sourceBytes,
    mimeType: props.mimeType,
    originalFilename: props.originalFilename,
  });
  const readyDir = path.dirname(props.readyPath);
  const readyFilePath = path.join(readyDir, processed.storedFilename);
  await writeFile(readyFilePath, processed.bytes);
  return {
    byteSize: processed.byteSize,
    mimeType: processed.mimeType,
    publicPath: buildCmsMediaPublicPath({
      id: props.assetId,
      filename: processed.storedFilename,
    }),
    readyFilePath,
    storedFilename: processed.storedFilename,
  };
}
