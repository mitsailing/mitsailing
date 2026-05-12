import * as z from 'zod';
import type { AdminCatalogResourceMessageKey } from '@/libs/admin/catalog/types';
import { isSafeCmsAppPath } from '@/libs/mit-sailing/cmsHref';
import { catalogUrlFragmentSlugSchema } from '@/libs/validation/catalogUrlFragmentSlugSchema';

const sailingClassesValidationMessages = {
  imagePaths: 'field_error_sailing_class_image_paths_safe_path',
} satisfies Record<string, AdminCatalogResourceMessageKey>;

function imagePathsFromLines(raw: string): string[] {
  const paths: string[] = [];
  const seen = new Set<string>();
  for (const path of raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)) {
    if (!seen.has(path)) {
      seen.add(path);
      paths.push(path);
    }
  }
  return paths;
}

/**
 * Validates sailing class create/update payloads from admin forms.
 */
export const sailingClassFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: catalogUrlFragmentSlugSchema,
  classCategoryId: z.string().trim().min(1),
  level: z.string().trim().min(1),
  description: z.string(),
  imagePaths: z
    .string()
    .transform(imagePathsFromLines)
    .refine(
      (paths) => paths.every((path) => isSafeCmsAppPath(path)),
      sailingClassesValidationMessages.imagePaths
    ),
  isVisible: z.boolean(),
});

/**
 * Parses {@link FormData} from the sailing class admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawSailingClassFromFormData(
  formData: FormData
): Record<string, unknown> {
  const visibilityFlags = formData.getAll('isVisible');
  const isVisible =
    visibilityFlags.includes('true') || visibilityFlags.includes('on');
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    classCategoryId: formData.get('classCategoryId'),
    level: formData.get('level'),
    description: formData.get('description') ?? '',
    imagePaths: formData.get('imagePaths') ?? '',
    isVisible,
  };
}
