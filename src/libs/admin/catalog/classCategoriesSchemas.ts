import * as z from 'zod';
import { catalogUrlFragmentSlugSchema } from '@/libs/validation/catalogUrlFragmentSlugSchema';

/**
 * Validates class category create/update payloads parsed from admin forms.
 */
export const classCategoryFormSchema = z.object({
  slug: catalogUrlFragmentSlugSchema,
  name: z.string().trim().min(1),
  isVisible: z.boolean(),
});

/**
 * Parses {@link FormData} from the class category admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawClassCategoryFromFormData(
  formData: FormData
): Record<string, unknown> {
  const visibilityFlags = formData.getAll('isVisible');
  const isVisible =
    visibilityFlags.includes('true') || visibilityFlags.includes('on');
  return {
    slug: formData.get('slug'),
    name: formData.get('name'),
    isVisible,
  };
}
