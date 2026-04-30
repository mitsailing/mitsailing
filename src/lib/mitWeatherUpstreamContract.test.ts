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
});
