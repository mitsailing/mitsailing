import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  listFleetBoatsForPublic: vi.fn(),
}));

vi.mock('@/libs/mit-sailing/fleetQueries', () => ({
  listFleetBoatsForPublic: mocks.listFleetBoatsForPublic,
}));

beforeEach(() => {
  mocks.listFleetBoatsForPublic.mockReset();
  mocks.listFleetBoatsForPublic.mockResolvedValue([
    {
      id: 'tech',
      name: 'Tech Dinghy',
      slug: 'tech-dinghy',
      type: 'Dinghy',
      capacity: 2,
      description: 'MIT training boat.',
      imagePath: null,
      requiredClass: { name: 'Learn to Sail', slug: 'learn-to-sail' },
      requiredRatings: [
        {
          id: 'rating-1',
          name: 'Provisional rating',
          shortName: 'Provisional',
          slug: 'provisional-rating',
          isDeprecated: false,
        },
      ],
    },
  ]);
});

describe('GET /api/public/boats', () => {
  it('returns public fleet discovery JSON', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=900');
    expect(body).toMatchObject({
      cacheSeconds: 900,
      boats: [
        {
          id: 'tech',
          name: 'Tech Dinghy',
          slug: 'tech-dinghy',
          requiredClass: { name: 'Learn to Sail', slug: 'learn-to-sail' },
          requiredRatings: [
            {
              id: 'rating-1',
              name: 'Provisional rating',
              shortName: 'Provisional',
              slug: 'provisional-rating',
            },
          ],
          detailUrl: 'https://mitsailing.com/fleet/tech-dinghy',
        },
      ],
    });
    expect(typeof body.generatedAt).toBe('string');
  });
});
