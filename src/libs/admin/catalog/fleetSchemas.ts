import * as z from 'zod';

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/**
 * Validates fleet boat create/update payloads parsed from admin forms.
 */
export const fleetBoatFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: slugSchema,
  type: z.string().trim().min(1),
  capacity: z.coerce.number().int().min(1),
  requiredClassId: z.string().trim().min(1),
  description: z.string(),
  imagePath: z.string().transform((raw) => {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  }),
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
