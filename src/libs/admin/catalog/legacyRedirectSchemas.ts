import * as z from 'zod';
import {
  normalizeLegacyRedirectPath,
  normalizeLegacyRedirectTargetPath,
} from '@/libs/mit-sailing/legacyRedirects';

/**
 * Validates legacy redirect create/update payloads parsed from admin forms.
 */
export const legacyRedirectFormSchema = z.object({
  source: z.enum(['ai_migration', 'manual']),
  sourcePath: z.string().transform((value, ctx) => {
    const normalized = normalizeLegacyRedirectPath(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid legacy source path',
      });
      return z.NEVER;
    }
    return normalized;
  }),
  targetPath: z.string().transform((value, ctx) => {
    const normalized = normalizeLegacyRedirectTargetPath(value);
    if (!normalized) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid target path',
      });
      return z.NEVER;
    }
    return normalized;
  }),
});

/**
 * Parses {@link FormData} from the legacy redirect admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema normalization
 */
export function rawLegacyRedirectFromFormData(
  formData: FormData
): Record<string, unknown> {
  return {
    source: formData.get('source') ?? 'manual',
    sourcePath: formData.get('sourcePath'),
    targetPath: formData.get('targetPath'),
  };
}
