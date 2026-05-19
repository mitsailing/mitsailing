import { describe, expect, it } from 'vitest';
import {
  eventCategoryCreateSchema,
  eventCategoryFormSchema,
  eventCategoryUpdateSchema,
} from '@/libs/zenstack/zod';

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

describe('eventCategoryCreateSchema', () => {
  it('parses only public event category create fields', () => {
    expect(
      eventCategoryCreateSchema.parse({
        isVisible: true,
        name: '  Regattas  ',
      })
    ).toEqual({
      isVisible: true,
      name: 'Regattas',
    });
  });

  it('rejects server-owned create fields', () => {
    expect(
      eventCategoryCreateSchema.safeParse({
        createdAt: new Date(),
        displayOrder: 1,
        id: 'cat-1',
        isVisible: true,
        name: 'Regattas',
      }).success
    ).toBe(false);
  });
});

describe('eventCategoryUpdateSchema', () => {
  it('parses only public event category update fields', () => {
    expect(
      eventCategoryUpdateSchema.parse({
        isVisible: false,
        name: '  Clinics  ',
      })
    ).toEqual({
      isVisible: false,
      name: 'Clinics',
    });
  });

  it('rejects accent and ordering fields during ordinary edits', () => {
    expect(
      eventCategoryUpdateSchema.safeParse({
        accentClassName: 'bg-mit-red',
        displayOrder: 1,
        isVisible: true,
        name: 'Regattas',
      }).success
    ).toBe(false);
  });
});
