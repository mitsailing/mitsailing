import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  listPublicEventsForDiscovery: vi.fn(),
}));

vi.mock('@/libs/mit-sailing/publicEventDiscovery', () => ({
  listPublicEventsForDiscovery: mocks.listPublicEventsForDiscovery,
  publicEventLimit: (value: number | undefined) => {
    if (value === undefined || !Number.isInteger(value)) {
      return 20;
    }
    return Math.min(50, Math.max(1, value));
  },
}));

beforeEach(() => {
  mocks.listPublicEventsForDiscovery.mockReset();
  mocks.listPublicEventsForDiscovery.mockResolvedValue({
    categories: [],
    events: [],
    generatedAt: '2026-06-01T12:00:00.000Z',
  });
});

describe('GET /api/public/events', () => {
  it('returns public event discovery JSON', async () => {
    mocks.listPublicEventsForDiscovery.mockResolvedValue({
      categories: [{ id: 'classes', name: 'Classes' }],
      events: [{ id: 'event-1', name: 'Intro Windsurfing' }],
      generatedAt: '2026-06-01T12:00:00.000Z',
    });
    const request = new NextRequest(
      'https://mitsailing.com/api/public/events?query=windsurfing&category=classes&limit=5'
    );

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('public');
    expect(mocks.listPublicEventsForDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'classes',
        limit: 5,
        query: 'windsurfing',
      })
    );
    expect(body).toEqual({
      cacheSeconds: 300,
      categories: [{ id: 'classes', name: 'Classes' }],
      events: [{ id: 'event-1', name: 'Intro Windsurfing' }],
      generatedAt: '2026-06-01T12:00:00.000Z',
    });
  });

  it('clamps unsafe limits for public callers', async () => {
    const request = new NextRequest(
      'https://mitsailing.com/api/public/events?limit=500'
    );

    await GET(request);

    expect(mocks.listPublicEventsForDiscovery).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 })
    );
  });
});
