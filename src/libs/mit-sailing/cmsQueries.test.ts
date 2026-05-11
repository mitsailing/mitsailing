import type * as ReactModule from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique } = vi.hoisted(() => ({
  findUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

vi.mock('@/libs/DB', () => ({
  prisma: { cmsPage: { findUnique } },
}));

beforeEach(() => {
  findUnique.mockReset();
});

describe('loadPublishedCmsPageByPath', () => {
  it('drops unsafe block ctaUrl values from the public DTO', async () => {
    const unsafeScriptHref = `${['java', 'script'].join('')}:alert(1)`;
    findUnique.mockResolvedValue({
      blocks: [
        {
          body: null,
          ctaLabel: 'Go',
          ctaUrl: unsafeScriptHref,
          id: 'b1',
          imageAlt: null,
          imageSrc: null,
          kind: 'hero',
          showCta: true,
          showImage: false,
          subtitle: null,
          title: 'H',
        },
      ],
      id: 'p1',
      isPublished: true,
      metaDescription: 'd',
      metaTitle: 'T',
      path: '/x',
      slug: 'x',
      title: 'T',
    });
    const { loadPublishedCmsPageByPath } =
      await import('@/libs/mit-sailing/cmsQueries');
    const page = await loadPublishedCmsPageByPath('/x');
    expect(page?.blocks[0]?.ctaUrl).toBeUndefined();
  });

  it('passes safe block ctaUrl through unchanged', async () => {
    findUnique.mockResolvedValue({
      blocks: [
        {
          body: null,
          ctaLabel: 'Go',
          ctaUrl: '/classes',
          id: 'b1',
          imageAlt: null,
          imageSrc: null,
          kind: 'hero',
          showCta: true,
          showImage: false,
          subtitle: null,
          title: 'H',
        },
      ],
      id: 'p1',
      isPublished: true,
      metaDescription: 'd',
      metaTitle: 'T',
      path: '/x',
      slug: 'x',
      title: 'T',
    });
    const { loadPublishedCmsPageByPath } =
      await import('@/libs/mit-sailing/cmsQueries');
    const page = await loadPublishedCmsPageByPath('/x');
    expect(page?.blocks[0]?.ctaUrl).toBe('/classes');
  });

  it('omits hidden optional block groups from the public DTO', async () => {
    findUnique.mockResolvedValue({
      blocks: [
        {
          body: null,
          ctaLabel: 'Go',
          ctaUrl: '/classes',
          id: 'b1',
          imageAlt: 'Sailing',
          imageSrc: '/cms-media/asset-1/sailing.jpg',
          kind: 'hero',
          showCta: false,
          showImage: false,
          subtitle: null,
          title: 'H',
        },
      ],
      id: 'p1',
      isPublished: true,
      metaDescription: 'd',
      metaTitle: 'T',
      path: '/x',
      slug: 'x',
      title: 'T',
    });
    const { loadPublishedCmsPageByPath } =
      await import('@/libs/mit-sailing/cmsQueries');
    const page = await loadPublishedCmsPageByPath('/x');
    expect(page?.blocks[0]?.ctaLabel).toBeUndefined();
    expect(page?.blocks[0]?.ctaUrl).toBeUndefined();
    expect(page?.blocks[0]?.imageAlt).toBeUndefined();
    expect(page?.blocks[0]?.imageSrc).toBeUndefined();
  });
});
