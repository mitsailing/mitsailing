import * as z from 'zod';

const requiredString = z.string().trim().min(1);
const optionalString = z
  .string()
  .trim()
  .transform((value) => value || null);
const optionalWindCondition = z
  .union([
    z.enum(['Low', 'Medium', 'Medium-strong', 'Strong', 'All']),
    z.literal(''),
  ])
  .transform((value) => value || null);
const optionalDisplayOrder = z.preprocess(
  (value) => (value === '' || value === null ? undefined : value),
  z.coerce.number().int().min(0).optional()
);
const defaultedGroupKey = z.preprocess(
  (value) =>
    value === null || (typeof value === 'string' && value.trim() === '')
      ? undefined
      : value,
  requiredString.default('default')
);

/**
 * Reads a boolean from admin {@link FormData} when the field uses the hidden
 * `false` plus checkbox pattern (see `CatalogBooleanField`); supports both
 * `value="true"` and the HTML default submitted value `on`.
 *
 * @param formData - Parsed admin form body
 * @param field - Checkbox field name
 * @returns True when the field includes a checked value (`true` or `on`)
 */
function catalogCheckboxBoolean(formData: FormData, field: string): boolean {
  const values = formData.getAll(field);
  return values.includes('true') || values.includes('on');
}

export const sailingRatingFormSchema = z.object({
  slug: requiredString,
  name: requiredString,
  shortName: optionalString,
  description: requiredString,
  category: optionalString,
  level: optionalString,
  windCondition: optionalWindCondition,
  guideUrl: optionalString,
  isVisible: z.boolean(),
  isDeprecated: z.boolean(),
});

/**
 * Parses {@link FormData} from the sailing rating admin form for Zod validation.
 *
 * @param formData - Submitted form body
 * @returns Parsed object before schema refinement
 */
export function rawSailingRatingFromFormData(formData: FormData) {
  return {
    slug: formData.get('slug'),
    name: formData.get('name'),
    shortName: formData.get('shortName'),
    description: formData.get('description'),
    category: formData.get('category'),
    level: formData.get('level'),
    windCondition: formData.get('windCondition'),
    guideUrl: formData.get('guideUrl'),
    isVisible: catalogCheckboxBoolean(formData, 'isVisible'),
    isDeprecated: catalogCheckboxBoolean(formData, 'isDeprecated'),
  };
}

export const sailingRatingRuleFormSchema = z.object({
  targetType: z.enum(['rating', 'class', 'boat']),
  targetId: requiredString,
  ruleType: z.enum(['requires', 'grants']),
  sailingRatingId: requiredString,
  groupKey: defaultedGroupKey,
  displayOrder: optionalDisplayOrder,
});

export function rawSailingRatingRuleFromFormData(formData: FormData) {
  return {
    targetType: formData.get('targetType'),
    targetId: formData.get('targetId'),
    ruleType: formData.get('ruleType'),
    sailingRatingId: formData.get('sailingRatingId'),
    groupKey: formData.get('groupKey'),
    displayOrder: formData.get('displayOrder'),
  };
}
