import 'server-only';
import { MIT_WEATHER_TXT_URL } from '@/lib/mitWeatherConstants';
import {
  parseMitSailingWeather,
  prepareMitWeatherUpstreamText,
  segmentsQuartetComplete,
  toDisplayWeatherSegments,
} from '@/lib/weatherParse';
import type { ParsedWeatherSegments } from '@/lib/weatherParse';
import { logger } from '@/libs/Logger';

/** Upstream polling window for MIT `weather.txt` (seconds). */
const WEATHER_UPSTREAM_REVALIDATE_SECONDS = 900;

/** Max time before aborting a single upstream GET (milliseconds). */
const WEATHER_FETCH_TIMEOUT_MS = 10_000;

export type WeatherHeaderData = ParsedWeatherSegments & {
  isFallback: boolean;
  sourceTimestamp?: string | null;
};

/** All fields null except `isFallback` when upstream unavailable. */
const FALLBACK_BROWNOUT: WeatherHeaderData = {
  windText: null,
  airText: null,
  waterText: null,
  sunsetText: null,
  isFallback: true,
};

/**
 * Operational `warn` — single-line `{key=value}` suffix for grep; avoids `error`/Sentry for routine upstream issues.
 *
 * @param options - `where` narrows the code path; `detail` is serialized as `k=v` pairs
 */
function logMitWeatherWarn(
  options: Readonly<{
    where: string;
    detail: Record<string, string | number | undefined>;
  }>
): void {
  const bits = [`[mit-weather:${options.where}]`];
  for (const [k, v] of Object.entries(options.detail)) {
    if (v === undefined) {
      continue;
    }
    bits.push(`${k}=${String(v)}`);
  }

  logger.warn(bits.join(' '));
}

/**
 * Pulls pavilion `weather.txt`, caches upstream for 900s; never propagates failures to the router.
 *
 * @returns Structured row data with field-level nulls translated to placeholders in UI
 */
export async function fetchWeatherHeaderData(): Promise<WeatherHeaderData> {
  try {
    const response = await fetch(MIT_WEATHER_TXT_URL, {
      signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
      next: { revalidate: WEATHER_UPSTREAM_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      logMitWeatherWarn({
        where: 'fetch',
        detail: {
          url: MIT_WEATHER_TXT_URL,
          status: response.status,
        },
      });
      return FALLBACK_BROWNOUT;
    }

    const rawBody = await response.text();
    const normalized = prepareMitWeatherUpstreamText(rawBody);
    if (!normalized) {
      logMitWeatherWarn({
        where: 'parse',
        detail: {
          url: MIT_WEATHER_TXT_URL,
          reason: 'empty_body',
        },
      });
      return FALLBACK_BROWNOUT;
    }

    const parsed = parseMitSailingWeather(normalized);

    const sourceTimestamp =
      response.headers.get('last-modified') ??
      response.headers.get('date') ??
      null;

    const display = toDisplayWeatherSegments(parsed);
    const complete = segmentsQuartetComplete(parsed);

    if (!complete) {
      logMitWeatherWarn({
        where: 'parse',
        detail: {
          url: MIT_WEATHER_TXT_URL,
          reason: 'incomplete_quartet',
        },
      });
      return {
        ...display,
        isFallback: true,
        sourceTimestamp,
      };
    }

    return {
      ...display,
      isFallback: false,
      sourceTimestamp,
    };
  } catch (error: unknown) {
    const aborted =
      error instanceof Error &&
      (error.name === 'AbortError' || error.message.includes('abort'));

    if (aborted) {
      logMitWeatherWarn({
        where: 'fetch',
        detail: {
          url: MIT_WEATHER_TXT_URL,
          reason: 'timeout_or_abort',
        },
      });
      return FALLBACK_BROWNOUT;
    }

    const failureDetail =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);

    logMitWeatherWarn({
      where: 'fetch',
      detail: {
        url: MIT_WEATHER_TXT_URL,
        reason: 'failure',
        message: failureDetail,
      },
    });

    return FALLBACK_BROWNOUT;
  }
}
