import { describe, expect, it } from 'vitest';
import { catalogResourceDefinitions } from '@/libs/admin/catalog/catalogDefinitions';
import {
  catalogEditableSnapshotsEqual,
  catalogSnapshotFormData,
  catalogSnapshotFromFormData,
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

  it('builds comparable form snapshots from submitted fields', () => {
    const formData = new FormData();
    formData.set('name', 'Rhodes 19');
    formData.set('slug', 'rhodes-19');
    formData.set('type', 'Keelboat');
    formData.set('capacity', '5');
    formData.set('requiredClassId', '');
    formData.set('description', '<p>Restored.</p>');
    formData.append('isVisible', 'false');
    formData.append('isVisible', 'true');
    formData.set('fleetVisibleBoats', '[]');

    expect(
      catalogSnapshotFromFormData(catalogResourceDefinitions.fleet, formData)
    ).toEqual({
      name: 'Rhodes 19',
      slug: 'rhodes-19',
      type: 'Keelboat',
      capacity: '5',
      requiredClassId: '',
      description: '<p>Restored.</p>',
      isVisible: true,
    });
  });

  it('matches editable snapshots with form-equivalent values', () => {
    expect(
      catalogEditableSnapshotsEqual(
        catalogResourceDefinitions.fleet,
        {
          name: 'Rhodes 19',
          slug: 'rhodes-19',
          type: 'Keelboat',
          capacity: 5,
          requiredClassId: null,
          description: '<p>Restored.</p>',
          isVisible: true,
          fleetVisibleBoats: '[]',
        },
        {
          name: 'Rhodes 19',
          slug: 'rhodes-19',
          type: 'Keelboat',
          capacity: '5',
          requiredClassId: '',
          description: '<p>Restored.</p>',
          isVisible: true,
        }
      )
    ).toBe(true);
  });

  it('detects changed editable snapshots', () => {
    expect(
      catalogEditableSnapshotsEqual(
        catalogResourceDefinitions.sailing_classes,
        {
          name: 'Intro to Sailing',
          slug: 'intro',
          classCategoryId: 'classes',
          level: 'Beginner',
          description: '<p>Current.</p>',
          isVisible: true,
        },
        {
          name: 'Intro to Sailing',
          slug: 'intro',
          classCategoryId: 'classes',
          level: 'Beginner',
          description: '<p>Current.</p>',
          isVisible: false,
        }
      )
    ).toBe(false);
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

  it('compares identical editable snapshot fields as unchanged', () => {
    const fields = catalogVersionDiffFields({
      definition: catalogResourceDefinitions.fleet,
      current: {
        name: 'Rhodes 19',
        slug: 'rhodes-19',
        type: 'Keelboat',
        capacity: 5,
        requiredClassId: 'intro-to-sailing',
        description: '<p>Restored.</p>',
        isVisible: false,
        fleetVisibleBoats: 'current helper payload',
      },
      snapshot: {
        name: 'Rhodes 19',
        slug: 'rhodes-19',
        type: 'Keelboat',
        capacity: 5,
        requiredClassId: 'intro-to-sailing',
        description: '<p>Restored.</p>',
        isVisible: false,
        fleetVisibleBoats: 'different helper payload',
      },
    });

    expect(fields.map((field) => field.field.field)).toEqual([
      'name',
      'slug',
      'type',
      'capacity',
      'requiredClassId',
      'description',
      'isVisible',
    ]);
    expect(fields.every((field) => !field.changed)).toBe(true);
  });

  it('compares changed string rich text and boolean fields as changed', () => {
    const fields = catalogVersionDiffFields({
      definition: catalogResourceDefinitions.sailing_classes,
      current: {
        name: 'Intro to Sailing',
        slug: 'intro',
        classCategoryId: 'classes',
        level: 'Beginner',
        description: '<p>Current description.</p>',
        isVisible: true,
      },
      snapshot: {
        name: 'Learn to Sail',
        slug: 'intro',
        classCategoryId: 'classes',
        level: 'Beginner',
        description: '<p>Snapshot description.</p>',
        isVisible: false,
      },
    });

    expect(fields.map((field) => [field.field.field, field.changed])).toEqual([
      ['name', true],
      ['slug', false],
      ['classCategoryId', false],
      ['level', false],
      ['description', true],
      ['isVisible', true],
    ]);
  });
});
