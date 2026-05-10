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
          id: 'child',
          parentId: 'parent',
          label: 'Child',
          isExternal: false,
          isVisible: true,
          displayOrder: 0,
        },
        {
          id: 'parent',
          label: 'Parent',
          isExternal: false,
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
          id: 'child',
          parentId: 'missing',
          label: 'Child',
          isExternal: false,
          isVisible: true,
          displayOrder: 0,
        },
      ],
    } satisfies CmsSeedMenu;

    expect(() => orderedCmsSeedMenuItems(menu)).toThrow(
      'CMS menu seed "menu" item "child" references missing parent "missing"'
    );
  });
});
