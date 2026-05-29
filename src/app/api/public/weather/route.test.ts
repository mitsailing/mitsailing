import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  fetchWeatherHeaderData: vi.fn(),
}));

vi.mock('@/lib/weather', () => ({
  fetchWeatherHeaderData: mocks.fetchWeatherHeaderData,
}));

beforeEach(() => {
  mocks.fetchWeatherHeaderData.mockReset();
  mocks.fetchWeatherHeaderData.mockResolvedValue({
    windText: 'NW 12 knots',
    airText: '62°F',
    waterText: '58°F',
    sunsetText: '8:12pm',
    isFallback: false,
    sourceTimestamp: 'Fri, 29 May 2026 01:30:00 GMT',
  });
});

describe('GET /api/public/weather', () => {
  it('returns first-party MIT Sailing weather with freshness metadata', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('s-maxage=900');
    expect(body).toMatchObject({
      cacheSeconds: 900,
      source: {
        name: 'First-party MIT Sailing collected weather data',
        url: 'https://sailing.mit.edu/weather/weather.txt',
        updatedAt: 'Fri, 29 May 2026 01:30:00 GMT',
      },
      status: 'available',
      conditions: {
        wind: 'NW 12 knots',
        air: '62°F',
        water: '58°F',
        sunset: '8:12pm',
      },
    });
    expect(typeof body.generatedAt).toBe('string');
  });

  it('marks weather unavailable when the first-party feed is unavailable', async () => {
    mocks.fetchWeatherHeaderData.mockResolvedValue({
      windText: null,
      airText: null,
      waterText: null,
      sunsetText: null,
      isFallback: true,
      sourceTimestamp: null,
    });

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      source: { updatedAt: null },
      status: 'unavailable',
      conditions: {
        wind: null,
        air: null,
        water: null,
        sunset: null,
      },
    });
  });
});
