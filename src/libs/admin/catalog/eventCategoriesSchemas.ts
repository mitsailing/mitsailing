import * as z from 'zod';

/**
 * Validates event category create/update payloads parsed from admin forms.
 */
export const eventCategoryFormSchema = z.object({
  name: z.string().trim().min(1),
  isVisible: z.boolean(),
});

/**
 * Parses {@link FormData} from the event category admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawEventCategoryFromFormData(
  formData: FormData
): Record<string, unknown> {
  const visibilityFlags = formData.getAll('isVisible');
  const isVisible =
    visibilityFlags.includes('true') || visibilityFlags.includes('on');
  return {
    name: formData.get('name'),
    isVisible,
  };
}
