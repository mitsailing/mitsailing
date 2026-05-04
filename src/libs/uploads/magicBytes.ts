/**
 * JPEG start of image marker.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like JPEG
 */
function matchJpeg(buffer: Buffer): boolean {
  return buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
}

/**
 * PNG file signature.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like PNG
 */
function matchPng(buffer: Buffer): boolean {
  return (
    buffer[0] === 137 &&
    buffer[1] === 80 &&
    buffer[2] === 78 &&
    buffer[3] === 71 &&
    buffer[4] === 13 &&
    buffer[5] === 10 &&
    buffer[6] === 26 &&
    buffer[7] === 10
  );
}

/**
 * GIF87a / GIF89a.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like GIF
 */
function matchGif(buffer: Buffer): boolean {
  return (
    buffer[0] === 71 &&
    buffer[1] === 73 &&
    buffer[2] === 70 &&
    buffer[3] === 56 &&
    (buffer[4] === 55 || buffer[4] === 57) &&
    buffer[5] === 97
  );
}

/**
 * RIFF container with WEBP at byte 8.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like WebP
 */
function matchWebp(buffer: Buffer): boolean {
  const riff =
    buffer[0] === 82 &&
    buffer[1] === 73 &&
    buffer[2] === 70 &&
    buffer[3] === 70;
  const webp =
    buffer[8] === 87 &&
    buffer[9] === 69 &&
    buffer[10] === 66 &&
    buffer[11] === 80;
  return riff && webp;
}

/**
 * PDF header `%PDF-`.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like PDF
 */
function matchPdf(buffer: Buffer): boolean {
  return (
    buffer[0] === 37 &&
    buffer[1] === 80 &&
    buffer[2] === 68 &&
    buffer[3] === 70 &&
    buffer[4] === 45
  );
}

/**
 * ISO base media / MP4 `ftyp` at offset 4.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like MP4
 */
function matchMp4(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer[4] === 102 &&
    buffer[5] === 116 &&
    buffer[6] === 121 &&
    buffer[7] === 112
  );
}

/**
 * Matroska / WebM EBML id.
 *
 * @param buffer - Bytes to inspect
 * @returns Whether the buffer looks like WebM
 */
function matchWebm(buffer: Buffer): boolean {
  return (
    buffer[0] === 26 &&
    buffer[1] === 69 &&
    buffer[2] === 223 &&
    buffer[3] === 163
  );
}

const MAGIC_BY_MIME: Record<string, (buffer: Buffer) => boolean> = {
  'image/jpeg': matchJpeg,
  'image/png': matchPng,
  'image/gif': matchGif,
  'image/webp': matchWebp,
  'application/pdf': matchPdf,
  'video/mp4': matchMp4,
  'video/webm': matchWebm,
};

/**
 * Verifies the first bytes of a buffer match the declared MIME (defense in
 * depth vs forged `Content-Type` / `file.type`).
 *
 * @param declaredMime - Client-declared MIME type
 * @param buffer - File bytes (prefix is inspected)
 * @returns Whether the signature matches the declared type
 */
export function declaredMimeMatchesMagicBytes(
  declaredMime: string,
  buffer: Buffer
): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const check = MAGIC_BY_MIME[declaredMime];
  return check ? check(buffer) : false;
}
