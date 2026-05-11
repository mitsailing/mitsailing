import { describe, expect, it } from 'vitest';
import type { CmsSeedMenu } from './cmsSeed';
import { orderedCmsSeedMenuItems } from './cmsSeed';

describe('orderedCmsSeedMenuItems', () => {
  it('orders parents before children', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'child',
          parentId: 'parent',
          label: 'Child',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'parent',
          label: 'Parent',
          isVisible: true,
          displayOrder: 0,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(orderedCmsSeedMenuItems(menu).map((item) => item.id)).toEqual([
      'parent',
      'child',
    ]);
  });

  it('rejects missing parent references', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'child',
          parentId: 'missing',
          label: 'Child',
          isVisible: true,
          displayOrder: 0,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" item "child" references missing parent "missing"'
    );
  });

  it('rejects duplicate item ids', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'dup',
          label: 'First',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'dup',
          label: 'Second',
          isVisible: true,
          displayOrder: 1,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" contains duplicate item "dup"'
    );
  });

  it('rejects parent cycles', () => {
    const menu = {
      id: 'menu',
      location: 'footer',
      title: 'Footer',
      items: [
        {
          kind: 'group',
          id: 'a',
          parentId: 'b',
          label: 'A',
          isVisible: true,
          displayOrder: 0,
        },
        {
          kind: 'group',
          id: 'b',
          parentId: 'a',
          label: 'B',
          isVisible: true,
          displayOrder: 1,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" contains a parent cycle at item "a"'
    );
  });
});
