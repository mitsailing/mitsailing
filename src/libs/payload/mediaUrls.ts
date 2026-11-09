/**
 * Payload media document shape used for public image URL mapping.
 */
export type PayloadMediaLike = {
  url?: null | string;
};

/**
 * Resolves the first media URL from a Payload upload field value.
 *
 * @param images - Upload field (ids and/or populated media docs)
 * @returns First absolute or app-relative media URL, or null
 */
export function firstMediaUrl(images: unknown): string | null {
  if (!Array.isArray(images)) {
    return null;
  }
  if (images.length === 0) {
    return null;
  }
  for (const image of images) {
    if (typeof image === 'object' && image !== null) {
      const candidate = 'url' in image ? image.url : undefined;
      const url = typeof candidate === 'string' ? candidate.trim() : '';
      if (url.length > 0) {
        return url;
      }
    }
  }
  return null;
}

/**
 * Collects media URLs from a Payload upload hasMany field.
 *
 * @param images - Upload field (ids and/or populated media docs)
 * @returns Ordered list of media URLs
 */
export function mediaUrls(images: unknown): string[] {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }
  const urls: string[] = [];
  for (const image of images) {
    if (typeof image === 'object' && image !== null) {
      const candidate = 'url' in image ? image.url : undefined;
      const url = typeof candidate === 'string' ? candidate.trim() : '';
      if (url.length > 0) {
        urls.push(url);
      }
    }
  }
  return urls;
}

/**
 * Stringifies a Payload document id for public DTOs that use string ids.
 *
 * @param id - Payload id (number or string)
 * @returns String id
 */
export const payloadIdString: (id: number | string) => string = String;
