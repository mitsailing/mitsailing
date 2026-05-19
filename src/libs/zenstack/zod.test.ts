import { describe, expect, it } from 'vitest';
import { eventCategoryFormSchema } from '@/libs/zenstack/zod';

describe('eventCategoryFormSchema', () => {
  it('parses event category form fields from ZenStack schema', () => {
    expect(
      eventCategoryFormSchema.parse({
        isVisible: true,
        name: '  Regattas  ',
      })
    ).toEqual({
      isVisible: true,
      name: 'Regattas',
    });
  });

  it('rejects blank names and extra model fields', () => {
    expect(
      eventCategoryFormSchema.safeParse({ isVisible: true, name: '   ' })
        .success
    ).toBe(false);
    expect(
      eventCategoryFormSchema.safeParse({
        displayOrder: 1,
        isVisible: true,
        name: 'Regattas',
      }).success
    ).toBe(false);
  });
});
