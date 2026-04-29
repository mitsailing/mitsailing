/**
 * Parses MIT Pavilion `weather.txt`–style lines: wind/air/water/sunset segments.
 */

export const FIELD_PLACEHOLDER = '—';

/** Four display segments (values only — labels applied in UI / i18n). */
export type ParsedWeatherSegments = {
  windText: string | null;
  airText: string | null;
  waterText: string | null;
  sunsetText: string | null;
};

/**
 * True when all four parsed segments are non-empty trimmed strings.
 *
 * @param segments - Raw parsed segments before display formatting
 * @returns Whether wind, air, water, and sunset segments are all present
 */
export function segmentsQuartetComplete(
  segments: ParsedWeatherSegments
): boolean {
  const parts = [
    segments.windText,
    segments.airText,
    segments.waterText,
    segments.sunsetText,
  ];
  return parts.every((p) => typeof p === 'string' && p.trim().length > 0);
}

const AIR_MARKER = ', Air ';
const WATER_MARKER = ', Water ';
const SUNSET_MARKER = ', Sunset ';
/** Maximum Unicode scalar (U+10FFFF). */
const MAX_UNICODE_SCALAR = 1_114_111;

/** Nautical knots per one statute mph (marine wind convention for US mph→kt). */
const KNOT_PER_STATUTE_MPH = 1 / 1.150_779_448_023_542;

function roundStatuteMphToWholeKnots(mph: number): number {
  return Math.round(mph * KNOT_PER_STATUTE_MPH);
}

/**
 * Replaces each statute `mph` span in wind copy with rounded knots (`9 knots`, `10 knots`).
 * Pass-through when there are no mph tokens (`calm`, etc.).
 *
 * @param windText - Parsed wind fragment (after glyph normalization when applicable)
 * @returns Wind string with knots, or pass-through/`null` when input is absent
 */
export function formatWindMphToKnotsForDisplay(
  windText: string | null
): string | null {
  if (!windText?.trim()) {
    return windText;
  }

  return windText.replaceAll(
    /\b(\d+(?:\.\d+)?)\s*mph\b/giu,
    (_, numStr: string) => {
      const mph = Number.parseFloat(numStr);
      if (Number.isNaN(mph)) {
        return `${numStr} mph`;
      }

      const knots = roundStatuteMphToWholeKnots(mph);

      return `${String(knots)} knots`;
    }
  );
}

/**
 * Collapses CRLF/TAB/multiple spaces to a single trimmed line with single spaces between tokens.
 *
 * @param input - Raw upstream blob
 * @returns Trimmed single-line string
 */
export function normalizeWeatherText(input: string): string {
  return input.replaceAll(/\s+/gu, ' ').trim();
}

/**
 * Drops leading junk (link text, UI labels) so the logical line starts at `Wind`.
 *
 * @param singleLine - Already whitespace-normalized line
 * @returns Text beginning at first `Wind` token or trimmed original when absent
 */
function trimToMitWeatherLineLead(singleLine: string): string {
  const m = /\bWind\b/iu.exec(singleLine);
  if (!m || m.index < 0) {
    return singleLine.trim();
  }

  return singleLine.slice(m.index).trim();
}

/**
 * Drops stray markup fragments stripped upstream may leave on the sunset segment (`</a>`).
 *
 * @param s - Raw sunset substring
 * @returns Plain text fragment
 */
function sanitizeHtmlishNoise(s: string): string {
  return s.replaceAll(/<\/?[^>]*>/gu, '').trim();
}

/**
 * Normalizes degree glyphs that often survive as mojibake after mixed encodings (`Â°F` → `°F`).
 *
 * @param value - Raw air/water/wind substring
 * @returns Cleaned glyphs for UI copy
 */
function normalizeTemperatureGlyphs(value: string | null): string | null {
  if (!value?.trim()) {
    return value;
  }

  return (
    value
      .replaceAll('\uFFFD', '')
      /** UTF-8 `°` read as Latin-1: `C2` + `B0` → Â + ° */
      .replaceAll('\u00C2\u00B0', '\u00B0')
      .replaceAll('Â°', '\u00B0')
      .trim() || value
  );
}

function stripWindPrefix(windSlice: string): string | null {
  const t = windSlice.trim();
  const windMatch = /^Wind\b\s*(.*)$/iu.exec(t);
  const rest = windMatch?.[1]?.trim();

  return rest?.length ? rest : null;
}

/**
 * Extracts structured segments from normalized MIT sailing weather blob.
 *
 * @param normalized - Output of [`normalizeWeatherText`] or [`prepareMitWeatherUpstreamText`]
 * @returns Parsed wind/air/water/sunset fragments
 */
export function parseMitSailingWeather(
  normalized: string
): ParsedWeatherSegments {
  const empty: ParsedWeatherSegments = {
    windText: null,
    airText: null,
    waterText: null,
    sunsetText: null,
  };

  const line = trimToMitWeatherLineLead(normalized);

  if (!line) {
    return empty;
  }

  const airIdx = line.indexOf(AIR_MARKER);
  if (airIdx === -1) {
    return empty;
  }

  const windSlice = line.slice(0, airIdx);
  const windText = stripWindPrefix(windSlice);

  const airStart = airIdx + AIR_MARKER.length;
  const waterIdx = line.indexOf(WATER_MARKER, airStart);
  if (waterIdx === -1) {
    return {
      windText,
      airText: line.slice(airStart).trim() || null,
      waterText: null,
      sunsetText: null,
    };
  }

  const airText = line.slice(airStart, waterIdx).trim() || null;
  const waterStart = waterIdx + WATER_MARKER.length;
  const sunsetIdx = line.indexOf(SUNSET_MARKER, waterStart);

  if (sunsetIdx === -1) {
    return {
      windText,
      airText,
      waterText: line.slice(waterStart).trim() || null,
      sunsetText: null,
    };
  }

  const waterText = line.slice(waterStart, sunsetIdx).trim() || null;
  const sunsetText =
    line.slice(sunsetIdx + SUNSET_MARKER.length).trim() || null;

  return {
    windText,
    airText,
    waterText,
    sunsetText,
  };
}

/**
 * MIT `weather.txt` sunset is 24h (`H:MM`). Formats to US 12h compact (`7:42pm`).
 *
 * @param sunsetRaw - Raw segment text or null
 * @returns Compact 12-hour string, pass-through when not `H:MM`, or null when empty
 */
export function formatSunsetTo12Hour(sunsetRaw: string | null): string | null {
  if (!sunsetRaw?.trim()) {
    return null;
  }

  const segment = sanitizeHtmlishNoise(sunsetRaw.trim());
  const clock = /\b(\d{1,2}):(\d{2})\b/u.exec(segment);
  if (!clock?.[1] || !clock[2]) {
    /** Preserve odd labels such as `n/a` once tags are trimmed. */
    return segment.length > 0 ? segment : null;
  }

  const [, hourChunk, mins] = clock;
  const hour24 = Number(hourChunk);
  if (Number.isNaN(hour24) || hour24 > 23 || Number.parseInt(mins, 10) > 59) {
    return `${hourChunk}:${mins}`;
  }

  const isPm = hour24 >= 12;
  let hour12 = hour24 % 12;
  if (hour12 === 0) {
    hour12 = 12;
  }

  return `${hour12}:${String(mins)}${isPm ? 'pm' : 'am'}`;
}

/**
 * Applies display-only tweaks: wind mph→knots, sunset AM/PM, glyph cleanup on temps.
 *
 * @param segments - Raw parsed segments
 * @returns Segments intended for `{value}` in i18n
 */
export function toDisplayWeatherSegments(
  segments: ParsedWeatherSegments
): ParsedWeatherSegments {
  const windGlyphs = normalizeTemperatureGlyphs(segments.windText);

  return {
    windText: formatWindMphToKnotsForDisplay(windGlyphs),
    airText: normalizeTemperatureGlyphs(segments.airText),
    waterText: normalizeTemperatureGlyphs(segments.waterText),
    sunsetText: formatSunsetTo12Hour(segments.sunsetText),
  };
}

/**
 * Cleans MIT weather blobs wrapped in stray markup / wrong encoding — strips HTML,
 * expands &#176;-style entities for `°F`, fixes `Â°F`, then [`normalizeWeatherText`].
 *
 * @param raw - Untrusted upstream body (`weather.txt`, or HTML wrappers)
 * @returns Canonical single line beginning at `Wind` when anchors exist
 */
export function prepareMitWeatherUpstreamText(raw: string): string {
  let s = raw.replaceAll('\uFEFF', '');
  /* eslint-disable unicorn/prefer-string-replace-all -- tag/entity passes need regex spans and casing */
  s = s.replaceAll(/<[^>]*>/gu, ' ');
  s = s.replaceAll(/&#(\d{1,5});/gu, (_, code: string) => {
    const n = Number(code);
    return n <= MAX_UNICODE_SCALAR ? String.fromCodePoint(n) : '';
  });
  s = s.replaceAll(/&#x([\da-f]{1,5});/giu, (_, hex: string) => {
    const n = Number.parseInt(hex, 16);
    return n <= MAX_UNICODE_SCALAR ? String.fromCodePoint(n) : '';
  });
  s = s.replaceAll(/&deg;/giu, '\u00B0');
  s = s.replaceAll(/&nbsp;/giu, ' ');
  s = s.replaceAll(/\u00C2\u00B0/gu, '\u00B0');
  s = s.replaceAll(/Â°/gu, '\u00B0');
  /* eslint-enable unicorn/prefer-string-replace-all */

  return trimToMitWeatherLineLead(normalizeWeatherText(s));
}
