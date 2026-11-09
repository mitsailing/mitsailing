import { describe, expect, it } from 'vitest';
import { safePublicCmsBlockImageSrc } from '@/libs/mit-sailing/cmsValidation';

describe('safePublicCmsBlockImageSrc', () => {
  it('canonicalizes trailing slashes on safe image paths', () => {
    expect(safePublicCmsBlockImageSrc('/cms-media/asset-1/hero.png/')).toBe(
      '/cms-media/asset-1/hero.png'
    );
  });

  it('rejects traversal and protocol-relative image paths', () => {
    expect(safePublicCmsBlockImageSrc('/assets/../secret.jpg')).toBeUndefined();
    expect(safePublicCmsBlockImageSrc('//evil.test/x.jpg')).toBeUndefined();
  });

  it('returns undefined for empty values', () => {
    expect(safePublicCmsBlockImageSrc()).toBeUndefined();
    expect(safePublicCmsBlockImageSrc(null)).toBeUndefined();
    expect(safePublicCmsBlockImageSrc('')).toBeUndefined();
  });
});
