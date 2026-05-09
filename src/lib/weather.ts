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

const WEATHER_UPSTREAM_REVALIDATE_MS =
  WEATHER_UPSTREAM_REVALIDATE_SECONDS * 1000;

/** In-memory cache TTL when data is a brownout placeholder (`isFallback`), so retries run before the full upstream poll window. */
const BROWNOUT_TTL_MS = 60_000;

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
 * In-memory weather header cache row for this Node worker: parsed payload plus wall-clock expiry.
 *
 * @property {WeatherHeaderData} data Display segments and `isFallback` when upstream was unavailable or incomplete.
 * @property {number} expiresAtMs Epoch milliseconds after which callers should refresh.
 */
type WeatherHeaderCacheEntry = {
  data: WeatherHeaderData;
  expiresAtMs: number;
};

/** Latest cached {@link WeatherHeaderData}, or `null` before the first successful refresh. */
let weatherHeaderCache: WeatherHeaderCacheEntry | null = null;

/** Shared in-flight refresh promise so concurrent requests await one upstream fetch; cleared when refresh completes. */
let weatherHeaderRefresh: Promise<WeatherHeaderData> | null = null;

/**
 * Operational `warn` — single-line `{key=value}` suffix for grep; avoids `error`/Sentry for routine upstream issues.
 *
 * @param options - `where` narrows the code path; `detail` is serialized as `k=v` pairs
 */
function logMitWeatherWarn(
  options: Readonly<{
    where: string;
    detail: Record<string, string | number>;
  }>
): void {
  const bits = [`[mit-weather:${options.where}]`];
  for (const [k, v] of Object.entries(options.detail)) {
    bits.push(`${k}=${String(v)}`);
  }

  logger.warn(bits.join(' '));
}

/**
 * Pulls pavilion `weather.txt`; never propagates failures to the router.
 *
 * @returns Structured row data with field-level nulls translated to placeholders in UI
 */
async function fetchFreshWeatherHeaderData(): Promise<WeatherHeaderData> {
  try {
    const response = await fetch(MIT_WEATHER_TXT_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(WEATHER_FETCH_TIMEOUT_MS),
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

/**
 * Fetches fresh weather, writes {@link weatherHeaderCache} (shorter TTL when `isFallback`), and clears {@link weatherHeaderRefresh} in `finally`.
 *
 * @returns Same shaped data as {@link fetchFreshWeatherHeaderData}
 */
async function refreshWeatherHeaderData(): Promise<WeatherHeaderData> {
  try {
    const data = await fetchFreshWeatherHeaderData();
    const ttlMs = data.isFallback
      ? BROWNOUT_TTL_MS
      : WEATHER_UPSTREAM_REVALIDATE_MS;
    weatherHeaderCache = {
      data,
      expiresAtMs: Date.now() + ttlMs,
    };

    return data;
  } finally {
    weatherHeaderRefresh = null;
  }
}

/**
 * Returns MIT weather from this Node worker's in-memory cache (900s for successful fetches; shorter TTL for brownout fallbacks).
 *
 * @returns Structured row data with field-level nulls translated to placeholders in UI
 */
export async function fetchWeatherHeaderData(): Promise<WeatherHeaderData> {
  const nowMs = Date.now();
  if (weatherHeaderCache && weatherHeaderCache.expiresAtMs > nowMs) {
    return weatherHeaderCache.data;
  }

  if (weatherHeaderRefresh) {
    const data = await weatherHeaderRefresh;
    return data;
  }

  weatherHeaderRefresh = refreshWeatherHeaderData();

  const data = await weatherHeaderRefresh;
  return data;
}
