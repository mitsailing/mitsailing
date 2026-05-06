import { describe, expect, it } from 'vitest';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';
import {
  catalogSnapshotFormData,
  catalogSnapshotFromRow,
  catalogSnapshotFromUnknown,
  catalogVersionDiffFields,
} from '@/libs/admin/catalog/catalogVersionSnapshots';

describe('catalogVersionSnapshots', () => {
  it('normalizes row snapshots without undefined fields', () => {
    expect(
      catalogSnapshotFromRow({
        id: 'boat-1',
        name: 'Tech Dinghy',
        capacity: 2,
        isVisible: true,
        optional: undefined,
      })
    ).toEqual({
      id: 'boat-1',
      name: 'Tech Dinghy',
      capacity: 2,
      isVisible: true,
    });
  });

  it('rejects snapshots with nested values', () => {
    expect(catalogSnapshotFromUnknown({ name: 'Intro', extra: [] })).toBeNull();
  });

  it('builds restore form data from editable fields', () => {
    const formData = catalogSnapshotFormData(catalogResourceDefinitions.fleet, {
      name: 'Rhodes 19',
      slug: 'rhodes-19',
      type: 'Keelboat',
      capacity: 5,
      requiredClassId: 'intro-to-sailing',
      description: '<p>Restored.</p>',
      isVisible: false,
      fleetVisibleBoats: '[]',
    });

    expect(formData.get('name')).toBe('Rhodes 19');
    expect(formData.get('capacity')).toBe('5');
    expect(formData.get('isVisible')).toBe('false');
    expect(formData.has('fleetVisibleBoats')).toBe(false);
  });

  it('marks changed fields in definition order', () => {
    const fields = catalogVersionDiffFields({
      definition: catalogResourceDefinitions.sailing_classes,
      current: {
        name: 'Intro to Sailing',
        slug: 'intro',
        classCategoryId: 'classes',
        level: 'Beginner',
        description: '<p>Current.</p>',
        isVisible: true,
      },
      snapshot: {
        name: 'Intro to Sailing',
        slug: 'intro-old',
        classCategoryId: 'classes',
        level: 'Beginner',
        description: '<p>Old.</p>',
        isVisible: true,
      },
    });

    expect(fields.map((field) => [field.field.field, field.changed])).toEqual([
      ['name', false],
      ['slug', true],
      ['classCategoryId', false],
      ['level', false],
      ['description', true],
      ['isVisible', false],
    ]);
  });
});
