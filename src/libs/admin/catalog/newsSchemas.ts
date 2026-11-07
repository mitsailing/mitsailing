import * as z from 'zod';
import { prismaDateFromIsoCalendar } from '@/libs/mit-sailing/isoCalendarDate';

/**
 * Validates news create/update payloads parsed from admin forms.
 */
export const newsFormSchema = z.object({
  body: z.coerce.string(),
  startDate: z.coerce.string().trim().min(1),
  lastDate: z.coerce.string().trim().min(1),
  isPublished: z.boolean(),
});

export type NewsFormValues = z.infer<typeof newsFormSchema>;

/**
 * Parses date-only fields into Prisma `@db.Date` values.
 *
 * @param data - Validated form values
 * @returns Dates or `null` when strings are invalid or last precedes start
 */
export function parseNewsDates(data: NewsFormValues): {
  startDate: Date;
  lastDate: Date;
} | null {
  const startDate = prismaDateFromIsoCalendar(data.startDate.trim());
  if (!startDate) {
    return null;
  }
  const lastDate = prismaDateFromIsoCalendar(data.lastDate.trim());
  if (!lastDate) {
    return null;
  }
  if (lastDate < startDate) {
    return null;
  }
  return { startDate, lastDate };
}

function formDataTextField(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v : '';
}

/**
 * Parses {@link FormData} from the news admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawNewsFromFormData(
  formData: FormData
): Record<string, unknown> {
  const visibilityFlags = formData.getAll('isPublished');
  const isPublished =
    visibilityFlags.includes('true') || visibilityFlags.includes('on');
  return {
    body: formDataTextField(formData, 'body'),
    startDate: formDataTextField(formData, 'startDate'),
    lastDate: formDataTextField(formData, 'lastDate'),
    isPublished,
  };
}
