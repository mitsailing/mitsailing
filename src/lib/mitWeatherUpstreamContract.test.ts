import { describe, expect, it } from 'vitest';
import { validateMitWeatherUpstreamContract } from './mitWeatherUpstreamContract';

describe('validateMitWeatherUpstreamContract', () => {
  it('accepts a complete MIT plaintext line with mph and °F', () => {
    const raw =
      'Wind ENE @ 11 mph, Gust 14 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42';
    expect(validateMitWeatherUpstreamContract(raw)).toEqual({ status: 'ok' });
  });

  it('reports breach when upstream drops mph in favor of knots only', () => {
    const raw =
      'Wind NW @ 8 knots, Gust 10 knots, Air 52°F, Water 54°F, Sunset 18:15';
    const got = validateMitWeatherUpstreamContract(raw);
    expect(got.status).toBe('breach');
    if (got.status === 'breach') {
      expect(got.breach.code).toBe('WIND_USES_KNOTS_INSTEAD_OF_MPH');
    }
  });

  it('reports breach when air temperature loses Fahrenheit', () => {
    const raw = 'Wind N @ 12 mph, Air 50°C, Water 57.0°F, Sunset 19:42';
    const got = validateMitWeatherUpstreamContract(raw);
    expect(got.status).toBe('breach');
    if (got.status === 'breach') {
      expect(got.breach.code).toBe('AIR_NOT_FAHRENHEIT');
    }
  });

  it.each([
    {
      raw: '   ',
      code: 'EMPTY_BODY',
    },
    {
      raw: 'Current conditions are offline',
      code: 'NO_WEATHER_ANCHORS',
    },
    {
      raw: 'Wind calm, Air 50°F, Water 57°F',
      code: 'INCOMPLETE_QUARTET',
    },
    {
      raw: 'Wind calm, Air 50°F, Water 57°F, Sunset 19:42',
      code: 'WIND_EXPECTS_MPH',
    },
    {
      raw: 'Wind N @ 12 mph, Air 50°F, Water 12°C, Sunset 19:42',
      code: 'WATER_NOT_FAHRENHEIT',
    },
    {
      raw: 'Wind N @ 12 mph, Air 50°F, Water 57°F, Sunset evening',
      code: 'SUNSET_NOT_CLOCK',
    },
  ] as const)('reports $code breach', (fixture) => {
    const got = validateMitWeatherUpstreamContract(fixture.raw);
    expect(got.status).toBe('breach');
    if (got.status === 'breach') {
      expect(got.breach.code).toBe(fixture.code);
      expect(got.breach.detail.length).toBeGreaterThan(0);
    }
  });
});
