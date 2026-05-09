import {
  parseMitSailingWeather,
  prepareMitWeatherUpstreamText,
  segmentsQuartetComplete,
} from '@/lib/weatherParse';

/**
 * Machine-checkable expectations for MIT `weather.txt` — **update this module** when product
 * intentionally supports new units (e.g. knots) or new fields.
 */
export type MitWeatherContractBreach = {
  code:
    | 'EMPTY_BODY'
    | 'NO_WEATHER_ANCHORS'
    | 'INCOMPLETE_QUARTET'
    | 'WIND_EXPECTS_MPH'
    | 'WIND_USES_KNOTS_INSTEAD_OF_MPH'
    | 'AIR_NOT_FAHRENHEIT'
    | 'WATER_NOT_FAHRENHEIT'
    | 'SUNSET_NOT_CLOCK';
  detail: string;
};

function segmentLooksLikeFahrenheit(s: string): boolean {
  return /\d/.test(s) && /°?\s*F\b/i.test(s);
}

/**
 * Validates a raw body against the **current** MIT strip contract (structure + units we display).
 * Safe to run on fixtures (unit tests) or live `fetch` text (opt-in integration).
 *
 * @param rawBody - Exact `response.text()` from the weather URL
 * @returns `{ status: 'ok' }` when the feed matches expectations, or `{ status: 'breach'; breach }`.
 */
export function validateMitWeatherUpstreamContract(
  rawBody: string
): { status: 'ok' } | { status: 'breach'; breach: MitWeatherContractBreach } {
  const prepared = prepareMitWeatherUpstreamText(rawBody);
  if (!prepared.trim()) {
    return {
      status: 'breach',
      breach: {
        code: 'EMPTY_BODY',
        detail: 'Upstream body was empty after normalization',
      },
    };
  }

  if (!prepared.includes(', Air ') || !prepared.includes(', Water ')) {
    return {
      status: 'breach',
      breach: {
        code: 'NO_WEATHER_ANCHORS',
        detail:
          'Expected ", Air " and ", Water " markers — upstream may have removed or renamed fields',
      },
    };
  }

  const parsed = parseMitSailingWeather(prepared);

  if (!segmentsQuartetComplete(parsed)) {
    return {
      status: 'breach',
      breach: {
        code: 'INCOMPLETE_QUARTET',
        detail: `Got wind=${String(parsed.windText)} air=${String(parsed.airText)} water=${String(parsed.waterText)} sunset=${String(parsed.sunsetText)}`,
      },
    };
  }

  const { windText, airText, waterText, sunsetText } = parsed;

  const wind = windText;
  const usesKnots = /\bknots?\b/i.test(wind);
  const usesMph = /\bmph\b/i.test(wind);

  if (usesKnots && !usesMph) {
    return {
      status: 'breach',
      breach: {
        code: 'WIND_USES_KNOTS_INSTEAD_OF_MPH',
        detail: `Wind line reports knots without mph: ${wind}`,
      },
    };
  }

  if (!usesMph) {
    return {
      status: 'breach',
      breach: {
        code: 'WIND_EXPECTS_MPH',
        detail: `Wind line no longer advertises mph (UI assumes mph): ${wind}`,
      },
    };
  }

  if (!segmentLooksLikeFahrenheit(airText)) {
    return {
      status: 'breach',
      breach: {
        code: 'AIR_NOT_FAHRENHEIT',
        detail: `Air line is not Fahrenheit: ${airText}`,
      },
    };
  }

  if (!segmentLooksLikeFahrenheit(waterText)) {
    return {
      status: 'breach',
      breach: {
        code: 'WATER_NOT_FAHRENHEIT',
        detail: `Water line is not Fahrenheit: ${waterText}`,
      },
    };
  }

  if (!/\b\d{1,2}:\d{2}\b/u.test(sunsetText)) {
    return {
      status: 'breach',
      breach: {
        code: 'SUNSET_NOT_CLOCK',
        detail: `Sunset line is not a clock time: ${sunsetText}`,
      },
    };
  }

  return { status: 'ok' };
}
