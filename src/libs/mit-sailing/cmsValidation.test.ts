import { describe, expect, it } from 'vitest';
import {
  cmsMenuItemInputSchema,
  cmsPageInputSchema,
  validateCmsMenuTree,
} from '@/libs/mit-sailing/cmsValidation';

describe('cms page validation', () => {
  it('normalizes internal page paths with trailing slashes', () => {
    const parsed = cmsPageInputSchema.parse({
      slug: 'about',
      path: '/about',
      title: 'About',
      metaTitle: 'About',
      metaDescription: 'About MIT Sailing',
      isPublished: true,
    });

    expect(parsed.path).toBe('/about/');
  });

  it('rejects protocol-relative paths', () => {
    const parsed = cmsPageInputSchema.safeParse({
      slug: 'bad',
      path: '//evil.test',
      title: 'Bad',
      metaTitle: 'Bad',
      metaDescription: 'Bad page',
      isPublished: true,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('cms menu item validation', () => {
  it('accepts containers without links', () => {
    const parsed = cmsMenuItemInputSchema.safeParse({
      menuId: 'menu',
      label: 'Footer column',
      isExternal: false,
      isVisible: true,
      displayOrder: 0,
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects javascript URLs', () => {
    const parsed = cmsMenuItemInputSchema.safeParse({
      menuId: 'menu',
      label: 'Bad',
      url: ['java', 'script:alert(1)'].join(''),
      isExternal: true,
      isVisible: true,
      displayOrder: 0,
    });

    expect(parsed.success).toBe(false);
  });
});

describe('cms menu tree validation', () => {
  it('rejects cycles', () => {
    const result = validateCmsMenuTree([
      { id: 'a', parentId: 'b' },
      { id: 'b', parentId: 'a' },
    ]);

    expect(result).toEqual({ ok: false, code: 'cycle' });
  });

  it('rejects missing parents', () => {
    const result = validateCmsMenuTree([{ id: 'a', parentId: 'missing' }]);

    expect(result).toEqual({ ok: false, code: 'missing_parent' });
  });
});
