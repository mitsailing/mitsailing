export const CMS_PRICING_MAX_PLANS = 4;

export type CmsPricingPlan = {
  title: string;
  description?: string;
  price: string;
  frequency?: string;
  badge?: string;
  linkLabel?: string;
  linkUrl?: string;
  features: string[];
  highlighted?: boolean;
};

export type CmsPricingData = {
  footnote?: string;
  plans: CmsPricingPlan[];
};

function propertyFromUnknown(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.getOwnPropertyDescriptor(value, key)?.value;
  }
  return undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function booleanFromUnknown(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function stringArrayFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const text = stringFromUnknown(item);
    return text ? [text] : [];
  });
}

function planFromUnknown(value: unknown): CmsPricingPlan | null {
  const title = stringFromUnknown(propertyFromUnknown(value, 'title'));
  const price = stringFromUnknown(propertyFromUnknown(value, 'price'));
  const features = stringArrayFromUnknown(
    propertyFromUnknown(value, 'features')
  );
  if (!title || !price || features.length === 0) {
    return null;
  }

  return {
    title,
    description: stringFromUnknown(propertyFromUnknown(value, 'description')),
    price,
    frequency: stringFromUnknown(propertyFromUnknown(value, 'frequency')),
    badge: stringFromUnknown(propertyFromUnknown(value, 'badge')),
    linkLabel: stringFromUnknown(propertyFromUnknown(value, 'linkLabel')),
    linkUrl: stringFromUnknown(propertyFromUnknown(value, 'linkUrl')),
    features,
    highlighted: booleanFromUnknown(propertyFromUnknown(value, 'highlighted')),
  };
}

/**
 * Parses structured pricing data stored in a CMS block body.
 *
 * @param body - JSON CMS block body
 * @returns Pricing data when the body has one to four valid plans
 */
export function parseCmsPricingBody(
  body: string | undefined
): CmsPricingData | null {
  if (!body) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const plansValue = propertyFromUnknown(parsed, 'plans');
  if (!Array.isArray(plansValue)) {
    return null;
  }

  const plans = plansValue.flatMap((value) => {
    const plan = planFromUnknown(value);
    return plan ? [plan] : [];
  });
  if (plans.length < 1 || plans.length > CMS_PRICING_MAX_PLANS) {
    return null;
  }

  return {
    footnote: stringFromUnknown(propertyFromUnknown(parsed, 'footnote')),
    plans,
  };
}

export function serializeCmsPricingBody(data: CmsPricingData): string {
  return JSON.stringify(data, null, 2);
}
