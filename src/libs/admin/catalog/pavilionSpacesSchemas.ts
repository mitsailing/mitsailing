import * as z from 'zod';
import type { AdminCatalogResourceMessageKey } from '@/libs/admin/catalog/types';
import { isSafeCmsAppPath } from '@/libs/mit-sailing/cmsHref';
import type { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPersonas';

const pavilionSpacesValidationMessages = {
  imagePaths: 'field_error_pavilion_spaces_image_paths_safe_path',
  publicGroup: 'field_error_pavilion_spaces_public_group',
  slug: 'field_error_pavilion_spaces_slug',
} satisfies Record<string, AdminCatalogResourceMessageKey>;

/**
 * Pavilion catalog slugs allow underscores (legacy) and kebab-case.
 */
const pavilionReservableItemSlugSchema = z
  .string()
  .trim()
  .min(1)
  .regex(
    /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/u,
    pavilionSpacesValidationMessages.slug
  );

function formOptionalBlankToUndefined(value: unknown): unknown {
  if (value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
}

function catalogCheckboxBoolean(formData: FormData, field: string): boolean {
  const values = formData.getAll(field);
  return values.includes('true') || values.includes('on');
}

function imagePathsFromLines(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * Blank → null (price on request). Otherwise non-negative whole dollars as cents.
 *
 * @param value - Raw form dollar amount
 * @returns Integer cents, `null` when blank, or `NaN` when invalid
 */
export function wholeDollarsCentsOrNullFromForm(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return null;
  }
  if (typeof value !== 'number' && typeof value !== 'string') {
    return Number.NaN;
  }
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return Number.NaN;
  }
  return Math.round(parsed) * 100;
}

const optionalWholeDollarCents = z.preprocess(
  (value) => {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
    return value;
  },
  z.union([z.null(), z.coerce.number().min(0)]).transform((value) => {
    if (value === null) {
      return null;
    }
    return Math.round(value) * 100;
  })
);

const optionalMinDurationHours = z.preprocess(
  formOptionalBlankToUndefined,
  z.coerce.number().int().positive().nullable().optional()
);

/**
 * Validates pavilion spaces/services catalog create/update payloads.
 */
export const pavilionSpaceFormSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: pavilionReservableItemSlugSchema,
    kind: z.enum(['space', 'service']),
    publicGroup: z
      .union([
        z.enum(['venue', 'event_options', 'programs']),
        z.literal(''),
        z.null(),
      ])
      .transform((value) => (value === '' || value === null ? null : value)),
    description: z.string(),
    pricingType: z.enum(['hourly', 'flat']),
    minDurationHours: optionalMinDurationHours,
    isVisible: z.boolean(),
    imagePaths: z
      .string()
      .transform(imagePathsFromLines)
      .refine(
        (paths) => paths.every((path) => isSafeCmsAppPath(path)),
        pavilionSpacesValidationMessages.imagePaths
      ),
    priceMitAcademic: optionalWholeDollarCents,
    priceMitStudent: optionalWholeDollarCents,
    priceMitCommunity: optionalWholeDollarCents,
    priceNonMit: optionalWholeDollarCents,
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'space' && data.publicGroup === null) {
      ctx.addIssue({
        code: 'custom',
        message: pavilionSpacesValidationMessages.publicGroup,
        path: ['publicGroup'],
      });
    }
    if (data.kind === 'service' && data.publicGroup !== null) {
      ctx.addIssue({
        code: 'custom',
        message: pavilionSpacesValidationMessages.publicGroup,
        path: ['publicGroup'],
      });
    }
    if (
      data.pricingType === 'hourly' &&
      (data.minDurationHours === null || data.minDurationHours === undefined)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'min_duration_required_for_hourly',
        path: ['minDurationHours'],
      });
    }
    if (data.pricingType === 'flat' && data.minDurationHours !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'min_duration_only_for_hourly',
        path: ['minDurationHours'],
      });
    }
  });

export type PavilionSpaceFormValues = z.infer<typeof pavilionSpaceFormSchema>;

/**
 * Parses {@link FormData} from the pavilion spaces admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawPavilionSpaceFromFormData(
  formData: FormData
): Record<string, unknown> {
  return {
    name: formData.get('name'),
    slug: formData.get('slug'),
    kind: formData.get('kind'),
    publicGroup: formData.get('publicGroup'),
    description: formData.get('description') ?? '',
    pricingType: formData.get('pricingType'),
    minDurationHours: formData.get('minDurationHours'),
    isVisible: catalogCheckboxBoolean(formData, 'isVisible'),
    imagePaths: formData.get('imagePaths') ?? '',
    priceMitAcademic: formData.get('priceMitAcademic'),
    priceMitStudent: formData.get('priceMitStudent'),
    priceMitCommunity: formData.get('priceMitCommunity'),
    priceNonMit: formData.get('priceNonMit'),
  };
}

/**
 * Maps flattened admin form persona dollar fields to cents by persona.
 *
 * @param data - Parsed form values
 * @returns Persona → cents map
 */
export function personaPriceCentsFromForm(
  data: PavilionSpaceFormValues
): Record<(typeof PAVILION_RESERVATION_PERSONAS)[number], number | null> {
  return {
    mit_academic: data.priceMitAcademic,
    mit_student: data.priceMitStudent,
    mit_community: data.priceMitCommunity,
    non_mit: data.priceNonMit,
  };
}
