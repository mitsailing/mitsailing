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
): segments is {
  windText: string;
  airText: string;
  waterText: string;
  sunsetText: string;
} {
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
 * Removes `<…>` spans and unclosed `<` tails so tag-shaped text cannot survive
 * (avoids single-pass-regex gaps where `<script` without `>` would remain).
 *
 * @param input - Raw copy that may include HTML wrappers or fragments
 * @param gapChar - Insert between former tag boundaries (`' '` for word safety, `''` for tight text)
 * @returns Copy with angle-bracket spans removed
 */
function stripHtmlAngleSpans(input: string, gapChar: string): string {
  let t = input;
  while (t.includes('<')) {
    const start = t.indexOf('<');
    const end = t.indexOf('>', start);
    t =
      end === -1
        ? t.slice(0, start)
        : t.slice(0, start) + gapChar + t.slice(end + 1);
  }
  return gapChar === '' ? t.replaceAll('>', '') : t.replaceAll('>', gapChar);
}

/**
 * Drops stray markup fragments stripped upstream may leave on the sunset segment (`</a>`).
 *
 * @param s - Raw sunset substring
 * @returns Plain text fragment
 */
function sanitizeHtmlishNoise(s: string): string {
  return stripHtmlAngleSpans(s, '').trim();
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

function trimmedTextOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function stripWindPrefix(windSlice: string): string | null {
  const t = windSlice.trim();
  const windMatch = /^Wind\b\s*(.*)$/iu.exec(t);
  const rest = windMatch?.[1];

  return typeof rest === 'string' ? trimmedTextOrNull(rest) : null;
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
      airText: trimmedTextOrNull(line.slice(airStart)),
      waterText: null,
      sunsetText: null,
    };
  }

  const airText = trimmedTextOrNull(line.slice(airStart, waterIdx));
  const waterStart = waterIdx + WATER_MARKER.length;
  const sunsetIdx = line.indexOf(SUNSET_MARKER, waterStart);

  if (sunsetIdx === -1) {
    return {
      windText,
      airText,
      waterText: trimmedTextOrNull(line.slice(waterStart)),
      sunsetText: null,
    };
  }

  const waterText = trimmedTextOrNull(line.slice(waterStart, sunsetIdx));
  const sunsetText = trimmedTextOrNull(
    line.slice(sunsetIdx + SUNSET_MARKER.length)
  );

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

/** Maximum Unicode scalar value U+10FFFF (inclusive). */
const MAX_UNICODE_SCALAR = 1_114_111;
/** High surrogate code unit range start (non-scalars). */
const SURROGATE_MIN = 55_296;
/** High surrogate code unit range end (non-scalars). */
const SURROGATE_MAX = 57_343;

export function isUnicodeScalarValue(cp: number): boolean {
  if (
    !Number.isFinite(cp) ||
    !Number.isInteger(cp) ||
    cp < 0 ||
    cp > MAX_UNICODE_SCALAR
  ) {
    return false;
  }
  /** `String.fromCodePoint` rejects surrogate code units as scalar values. */
  return cp < SURROGATE_MIN || cp > SURROGATE_MAX;
}

function scalarCharFromParsedEntity(cp: number, fallback: string): string {
  return isUnicodeScalarValue(cp) ? String.fromCodePoint(cp) : fallback;
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
  s = stripHtmlAngleSpans(s, ' ');
  s = s.replaceAll(/&#(\d{1,7});/gu, (full, code: string) =>
    scalarCharFromParsedEntity(Number(code), full)
  );
  s = s.replaceAll(/&#x([\da-f]{1,6});/giu, (full, hex: string) =>
    scalarCharFromParsedEntity(Number.parseInt(hex, 16), full)
  );
  s = s.replaceAll(/&deg;/giu, '\u00B0');
  s = s.replaceAll(/&nbsp;/giu, ' ');
  s = s.replaceAll(/\u00C2\u00B0/gu, '\u00B0');
  s = s.replaceAll(/Â°/gu, '\u00B0');
  /* eslint-enable unicorn/prefer-string-replace-all */

  return trimToMitWeatherLineLead(normalizeWeatherText(s));
}
