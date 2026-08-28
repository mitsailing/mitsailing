import { describe, expect, it } from 'vitest';
import {
  pavilionSpaceFormSchema,
  rawPavilionSpaceFromFormData,
  wholeDollarsCentsOrNullFromForm,
} from '@/libs/admin/catalog/pavilionSpacesSchemas';

function formDataFromEntries(
  entries: Record<string, string | string[]>
): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        formData.append(key, entry);
      }
      continue;
    }
    formData.append(key, value);
  }
  return formData;
}

describe('wholeDollarsCentsOrNullFromForm', () => {
  it('maps blank to null for price on request', () => {
    expect(wholeDollarsCentsOrNullFromForm('')).toBeNull();
    expect(wholeDollarsCentsOrNullFromForm('  ')).toBeNull();
    expect(wholeDollarsCentsOrNullFromForm(null)).toBeNull();
  });

  it('maps whole dollars to cents', () => {
    expect(wholeDollarsCentsOrNullFromForm('320')).toBe(32_000);
    expect(wholeDollarsCentsOrNullFromForm('0')).toBe(0);
    expect(wholeDollarsCentsOrNullFromForm('320.4')).toBe(32_000);
  });
});

describe('pavilionSpaceFormSchema', () => {
  it('accepts a venue space with persona prices', () => {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(
        formDataFromEntries({
          name: 'Casual dock',
          slug: 'casual_dock',
          kind: 'space',
          publicGroup: 'venue',
          description: 'Dock space',
          pricingType: 'hourly',
          minDurationHours: '1',
          isVisible: 'true',
          imagePaths: '',
          priceMitAcademic: '320',
          priceMitStudent: '200',
          priceMitCommunity: '320',
          priceNonMit: '580',
        })
      )
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.priceMitAcademic).toBe(32_000);
    expect(parsed.data.publicGroup).toBe('venue');
  });

  it('maps blank persona amounts to null', () => {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(
        formDataFromEntries({
          name: 'Lab access',
          slug: 'lab_access',
          kind: 'space',
          publicGroup: 'programs',
          description: 'Fees arranged',
          pricingType: 'flat',
          isVisible: 'true',
          imagePaths: '',
          priceMitAcademic: '',
          priceMitStudent: '',
          priceMitCommunity: '',
          priceNonMit: '',
        })
      )
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.priceMitAcademic).toBeNull();
    expect(parsed.data.minDurationHours).toBeUndefined();
  });

  it('requires public group for spaces', () => {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(
        formDataFromEntries({
          name: 'Dock',
          slug: 'dock',
          kind: 'space',
          publicGroup: '',
          description: 'x',
          pricingType: 'flat',
          isVisible: 'true',
          imagePaths: '',
          priceMitAcademic: '10',
          priceMitStudent: '10',
          priceMitCommunity: '10',
          priceNonMit: '10',
        })
      )
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects public group on services', () => {
    const parsed = pavilionSpaceFormSchema.safeParse(
      rawPavilionSpaceFromFormData(
        formDataFromEntries({
          name: 'Wedding service',
          slug: 'wedding_service',
          kind: 'service',
          publicGroup: 'event_options',
          description: 'x',
          pricingType: 'flat',
          isVisible: 'false',
          imagePaths: '',
          priceMitAcademic: '',
          priceMitStudent: '650',
          priceMitCommunity: '650',
          priceNonMit: '825',
        })
      )
    );
    expect(parsed.success).toBe(false);
  });
});
