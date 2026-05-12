import { describe, expect, it } from 'vitest';
import { sailingRatingFormSchema } from '@/libs/admin/catalog/sailingRatingsSchemas';

function minimalRatingInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    slug: 'swim',
    name: 'Swim',
    shortName: '',
    description: 'Test',
    category: '',
    level: '',
    windCondition: '',
    guideUrl: '',
    isVisible: true,
    isDeprecated: false,
    ...overrides,
  };
}

describe('sailingRatingFormSchema', () => {
  describe('guideUrl', () => {
    it('maps blank to null', () => {
      const parsed = sailingRatingFormSchema.safeParse(minimalRatingInput());
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.guideUrl).toBeNull();
      }
    });

    it('accepts trimmed https URL with host', () => {
      const parsed = sailingRatingFormSchema.safeParse(
        minimalRatingInput({
          guideUrl: '  https://sailing.mit.edu/card/swim.php  ',
        })
      );
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.guideUrl).toBe(
          'https://sailing.mit.edu/card/swim.php'
        );
      }
    });

    it('accepts http localhost', () => {
      const parsed = sailingRatingFormSchema.safeParse(
        minimalRatingInput({ guideUrl: 'http://localhost/guide' })
      );
      expect(parsed.success).toBe(true);
    });

    it('rejects relative path', () => {
      const parsed = sailingRatingFormSchema.safeParse(
        minimalRatingInput({ guideUrl: '/docs/guide' })
      );
      expect(parsed.success).toBe(false);
    });

    it('rejects javascript scheme', () => {
      const maliciousGuideUrl = ['javascript', 'alert(1)'].join(':');
      const parsed = sailingRatingFormSchema.safeParse(
        minimalRatingInput({ guideUrl: maliciousGuideUrl })
      );
      expect(parsed.success).toBe(false);
    });

    it('rejects ftp URL', () => {
      const parsed = sailingRatingFormSchema.safeParse(
        minimalRatingInput({ guideUrl: 'ftp://example.com/file' })
      );
      expect(parsed.success).toBe(false);
    });
  });
});
