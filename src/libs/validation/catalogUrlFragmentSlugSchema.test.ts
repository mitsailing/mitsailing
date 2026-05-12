import { describe, expect, it } from 'vitest';
import { catalogUrlFragmentSlugSchema } from '@/libs/validation/catalogUrlFragmentSlugSchema';

describe('catalogUrlFragmentSlugSchema', () => {
  it('accepts lowercase kebab-case', () => {
    const parsed = catalogUrlFragmentSlugSchema.safeParse('intro-sailing');
    expect(parsed.success).toBe(true);
  });

  it('rejects internal spaces', () => {
    expect(catalogUrlFragmentSlugSchema.safeParse('bad slug').success).toBe(
      false
    );
  });

  it('rejects hash fragment characters', () => {
    expect(catalogUrlFragmentSlugSchema.safeParse('a#b').success).toBe(false);
  });
});
