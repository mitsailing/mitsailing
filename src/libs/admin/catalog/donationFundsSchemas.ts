import * as z from 'zod';

/**
 * Validates donation fund create/update payloads parsed from admin forms.
 */
export const donationFundFormSchema = z.object({
  fundId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string(),
  url: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.url()),
  isVisible: z.boolean(),
});

/**
 * Parses {@link FormData} from the donation fund admin form into a plain object
 * for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawDonationFundFromFormData(
  formData: FormData
): Record<string, unknown> {
  const visibilityFlags = formData.getAll('isVisible');
  const isVisible =
    visibilityFlags.includes('true') || visibilityFlags.includes('on');
  return {
    fundId: formData.get('fundId'),
    name: formData.get('name'),
    description: formData.get('description') ?? '',
    url: formData.get('url'),
    isVisible,
  };
}
