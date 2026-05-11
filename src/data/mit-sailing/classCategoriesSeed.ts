import type { ClassCategory } from './classesFleetSeed';

/** Stable PKs for `class_categories.id` (FK from `sailing_classes`). */
export type ClassCategoryRow = {
  id: string;
  slug: string;
  /** Matches `SailingClass.category` in classesFleetSeed */
  seedKey: ClassCategory;
  name: string;
  displayOrder: number;
};

/**
 * Canonical display order for class categories (nav + /classes sections).
 */
export const CLASS_CATEGORY_ROWS: ClassCategoryRow[] = [
  {
    id: 'cc-introduction',
    slug: 'introduction',
    seedKey: 'introduction',
    name: 'Introduction',
    displayOrder: 0,
  },
  {
    id: 'cc-windsurfing',
    slug: 'windsurfing',
    seedKey: 'windsurfing',
    name: 'Windsurfing',
    displayOrder: 1,
  },
  {
    id: 'cc-intro-to-racing',
    slug: 'intro-to-racing',
    seedKey: 'intro to racing',
    name: 'Intro To Racing',
    displayOrder: 2,
  },
  {
    id: 'cc-intermediate-sailing',
    slug: 'intermediate-sailing',
    seedKey: 'intermediate sailing',
    name: 'Intermediate Sailing',
    displayOrder: 3,
  },
  {
    id: 'cc-intermediate-racing',
    slug: 'intermediate-racing',
    seedKey: 'intermediate racing',
    name: 'Intermediate Racing',
    displayOrder: 4,
  },
  {
    id: 'cc-rating-checkoffs',
    slug: 'rating-checkoffs',
    seedKey: 'rating checkoffs',
    name: 'Rating Checkoffs',
    displayOrder: 5,
  },
  {
    id: 'cc-bluewater',
    slug: 'bluewater',
    seedKey: 'bluewater',
    name: 'Bluewater',
    displayOrder: 6,
  },
];

const seedKeyToId = new Map<ClassCategory, string>(
  CLASS_CATEGORY_ROWS.map((r) => [r.seedKey, r.id])
);

export function overrideClassCategorySeedId(
  seedKey: ClassCategory,
  id: string
): void {
  seedKeyToId.set(seedKey, id);
}

/**
 * @param seedKey - Value from sailing class seed `category`
 * @returns `class_categories.id`
 */
export function classCategoryIdFromSeedKey(seedKey: ClassCategory): string {
  const id = seedKeyToId.get(seedKey);
  if (!id) {
    throw new Error(`Unknown class category seed key: ${seedKey}`);
  }
  return id;
}
