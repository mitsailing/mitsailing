import { describe, expect, it } from 'vitest';
import { MIT_WEATHER_TXT_URL } from '../../src/lib/mitWeatherConstants';
import { validateMitWeatherUpstreamContract } from '../../src/lib/mitWeatherUpstreamContract';

/**
 * Live third-party contract check — **opt-in** (`RUN_MIT_WEATHER_CONTRACT=1`) so CI and
 * default `npm test` never depend on MIT network or rate limits.
 *
 * Run: `npm run test:mit-weather-contract`
 */
describe.skipIf(process.env.RUN_MIT_WEATHER_CONTRACT !== '1')(
  'MIT weather.txt upstream (live contract)',
  () => {
    it('current sailing.mit.edu weather.txt still matches parse and unit expectations', async () => {
      const response = await fetch(MIT_WEATHER_TXT_URL, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error(
          `GET ${MIT_WEATHER_TXT_URL} failed: ${response.status}`
        );
      }
      const rawBody = await response.text();
      const result = validateMitWeatherUpstreamContract(rawBody);
      if (result.status !== 'ok') {
        throw new Error(
          `Contract breach: ${result.breach.code} — ${result.breach.detail}`
        );
      }
      expect(result.status).toBe('ok');
    }, 45_000);
  }
);
