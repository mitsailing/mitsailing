import * as z from 'zod';
import { isSafeCmsAppPath } from '@/libs/mit-sailing/cmsHref';
import type messages from '@/locales/en.json';

type AdminCatalogResourceMessageKey =
  keyof typeof messages.AdminCatalogResource;

const cmsImagePathMessage =
  'field_error_cms_image_path_safe_path' satisfies AdminCatalogResourceMessageKey;

function canonicalCmsAppPath(path: string): string {
  return path === '/' ? path : path.replace(/\/+$/u, '');
}

const cmsImagePathSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => isSafeCmsAppPath(value), cmsImagePathMessage)
  .transform((value) => canonicalCmsAppPath(value));

/**
 * Validates and canonicalizes a CMS block image path for public page DTO emission.
 *
 * @param value - Raw image path from published CMS content
 * @returns Canonical safe path, or `undefined` when missing or invalid
 */
export function safePublicCmsBlockImageSrc(
  value?: string | null
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const parsed = cmsImagePathSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
