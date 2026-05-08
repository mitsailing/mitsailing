import * as z from 'zod';

const requiredString = z.string().trim().min(1);
const optionalString = z
  .string()
  .trim()
  .transform((value) => value || null);

export const sailingRatingFormSchema = z.object({
  slug: requiredString,
  name: requiredString,
  shortName: optionalString,
  description: requiredString,
  category: optionalString,
  level: optionalString,
  windCondition: optionalString,
  guideUrl: optionalString,
  isVisible: z.boolean(),
  isDeprecated: z.boolean(),
});

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
    isVisible: formData.get('isVisible') === 'true',
    isDeprecated: formData.get('isDeprecated') === 'true',
  };
}

export const sailingRatingRuleFormSchema = z.object({
  targetType: z.enum(['rating', 'class', 'boat']),
  targetId: requiredString,
  ruleType: z.enum(['requires', 'grants']),
  sailingRatingId: requiredString,
  groupKey: requiredString.default('default'),
});

export function rawSailingRatingRuleFromFormData(formData: FormData) {
  return {
    targetType: formData.get('targetType'),
    targetId: formData.get('targetId'),
    ruleType: formData.get('ruleType'),
    sailingRatingId: formData.get('sailingRatingId'),
    groupKey: formData.get('groupKey') ?? 'default',
  };
}
