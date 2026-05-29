import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  listSailingClassesGroupedForCatalog: vi.fn(),
}));

vi.mock('@/libs/mit-sailing/classQueries', () => ({
  listSailingClassesGroupedForCatalog:
    mocks.listSailingClassesGroupedForCatalog,
}));

beforeEach(() => {
  mocks.listSailingClassesGroupedForCatalog.mockReset();
  mocks.listSailingClassesGroupedForCatalog.mockResolvedValue([
    {
      category: {
        id: 'intro',
        name: 'Intro classes',
        slug: 'intro',
        displayOrder: 1,
      },
      classes: [
        {
          id: 'class-1',
          name: 'Learn to Sail',
          slug: 'learn-to-sail',
          level: 'Beginner',
          description: 'Start sailing on the Charles.',
          imagePaths: [],
        },
      ],
    },
  ]);
});

describe('GET /api/public/classes', () => {
  it('returns public class discovery JSON', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=900');
    expect(body).toMatchObject({
      cacheSeconds: 900,
      categories: [{ id: 'intro', name: 'Intro classes', slug: 'intro' }],
      classes: [
        {
          id: 'class-1',
          name: 'Learn to Sail',
          slug: 'learn-to-sail',
          category: { id: 'intro', name: 'Intro classes', slug: 'intro' },
          detailUrl: 'https://mitsailing.com/classes/learn-to-sail',
        },
      ],
    });
    expect(typeof body.generatedAt).toBe('string');
  });
});
