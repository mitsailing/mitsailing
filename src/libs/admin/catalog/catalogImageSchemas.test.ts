import { describe, expect, it } from 'vitest';
import { fleetBoatFormSchema } from '@/libs/admin/catalog/fleetSchemas';
import { sailingClassFormSchema } from '@/libs/admin/catalog/sailingClassesSchemas';

function fleetInput(imagePath: string) {
  return {
    capacity: '2',
    description: '<p>Fast boat</p>',
    imagePath,
    name: 'Tech Dinghy',
    requiredClassId: 'class-1',
    slug: 'tech-dinghy',
    type: 'Dinghy',
  };
}

function sailingClassInput(imagePaths: string) {
  return {
    classCategoryId: 'category-1',
    description: '<p>Learn the basics</p>',
    imagePaths,
    isVisible: true,
    level: 'beginner',
    name: 'Intro Sailing',
    slug: 'intro-sailing',
  };
}

describe('fleetBoatFormSchema', () => {
  it('keeps empty image input as null', () => {
    const parsed = fleetBoatFormSchema.parse(fleetInput('  '));

    expect(parsed.imagePath).toBeNull();
  });

  it('rejects unsafe image paths', () => {
    for (const imagePath of [
      '//evil.test/boat.jpg',
      '/images/../secret.jpg',
      '/images/boat.jpg?cache=1',
      'C:\\images\\boat.jpg',
    ]) {
      expect(fleetBoatFormSchema.safeParse(fleetInput(imagePath)).success).toBe(
        false
      );
    }
  });
});

describe('sailingClassFormSchema', () => {
  it('deduplicates image paths while preserving order', () => {
    const parsed = sailingClassFormSchema.parse(
      sailingClassInput(
        [
          '/images/class-a.jpg',
          '/images/class-b.jpg',
          '/images/class-a.jpg',
        ].join('\n')
      )
    );

    expect(parsed.imagePaths).toEqual([
      '/images/class-a.jpg',
      '/images/class-b.jpg',
    ]);
  });

  it('rejects unsafe image paths', () => {
    for (const imagePaths of [
      '/images/../secret.jpg',
      '/images/class.jpg#photo',
      '/\\evil.test',
    ]) {
      expect(
        sailingClassFormSchema.safeParse(sailingClassInput(imagePaths)).success
      ).toBe(false);
    }
  });
});
