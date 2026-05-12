import * as z from 'zod';
import type { AdminCatalogResourceMessageKey } from '@/libs/admin/catalog/types';
import { isSafeCmsAppPath } from '@/libs/mit-sailing/cmsHref';
import { catalogUrlFragmentSlugSchema } from '@/libs/validation/catalogUrlFragmentSlugSchema';

const fleetBoatValidationMessages = {
  imagePath: 'field_error_fleet_image_path_safe_path',
} satisfies Record<string, AdminCatalogResourceMessageKey>;

/**
 * Validates fleet boat create/update payloads parsed from admin forms.
 */
export const fleetBoatFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: catalogUrlFragmentSlugSchema,
  type: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1),
  requiredClassId: z.string().trim().min(1),
  description: z.string(),
  imagePath: z
    .string()
    .transform((raw) => {
      const trimmed = raw.trim();
      return trimmed.length > 0 ? trimmed : null;
    })
    .refine(
      (value) => value === null || isSafeCmsAppPath(value),
      fleetBoatValidationMessages.imagePath
    ),
});

/**
 * Parses {@link FormData} from the fleet boat admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawFleetBoatFromFormData(
  formData: FormData
): Record<string, unknown> {
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    type: formData.get('type'),
    capacity: formData.get('capacity'),
    requiredClassId: formData.get('requiredClassId'),
    description: formData.get('description') ?? '',
    imagePath: formData.get('imagePath') ?? '',
  };
}
