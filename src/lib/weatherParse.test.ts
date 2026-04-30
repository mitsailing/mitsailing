import { describe, expect, it } from 'vitest';
import {
  formatSunsetTo12Hour,
  formatWindMphToKnotsForDisplay,
  normalizeWeatherText,
  parseMitSailingWeather,
  prepareMitWeatherUpstreamText,
  toDisplayWeatherSegments,
} from './weatherParse';

describe('weatherParse', () => {
  describe('normalizeWeatherText', () => {
    it('collapses internal whitespace and line breaks to single spaces', () => {
      expect(
        normalizeWeatherText('  Wind   ENE \r\n @ 11 mph,  \t Air  49°F  ')
      ).toBe('Wind ENE @ 11 mph, Air 49°F');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeWeatherText('\n  x  \n')).toBe('x');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeWeatherText('   \t\n')).toBe('');
    });
  });

  describe('prepareMitWeatherUpstreamText', () => {
    it('strips stray HTML wrappers and fixes common degree mojibake before anchors run', () => {
      const noisy = `
        <html><body>
        <div>Weather</div>
        <p>
        MIT &mdash; <a href="/x">Current</a> —
        Wind SSW @ 6 mph, Gust 7 mph, Air 52.9\u00C2\u00B0F, Water 59.9\u00C2\u00B0F, Sunset 21:52
        </p></body></html>
      `;
      const normalized = prepareMitWeatherUpstreamText(noisy);
      expect(normalized.startsWith('Wind ')).toBe(true);
      expect(normalized).not.toMatch(/<[^>]+>/u);
      const parsed = parseMitSailingWeather(normalized);
      expect(parsed.windText).toBe('SSW @ 6 mph, Gust 7 mph');
      expect(toDisplayWeatherSegments(parsed).windText).toBe(
        'SSW @ 5 knots, Gust 6 knots'
      );
      expect(toDisplayWeatherSegments(parsed).airText).toBe('52.9°F');
      expect(toDisplayWeatherSegments(parsed).waterText).toBe('59.9°F');
      expect(toDisplayWeatherSegments(parsed).sunsetText).toBe('9:52pm');
    });

    it('decodes numeric entities for the degree symbol when MIT serves HTML entities', () => {
      const raw = 'Wind calm, Air 49.9&#176;F, Water 57.0&#176;F, Sunset 19:42';
      const normalized = prepareMitWeatherUpstreamText(raw);
      expect(normalized).toContain('49.9°F');
      const parsed = parseMitSailingWeather(normalized);
      expect(toDisplayWeatherSegments(parsed).airText).toBe('49.9°F');
    });
  });

  describe('parseMitSailingWeather', () => {
    it('parses canonical MIT sailing weather line segments', () => {
      const input = normalizeWeatherText(
        'Wind ENE @ 11 mph, Gust 14 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42'
      );

      expect(parseMitSailingWeather(input)).toEqual({
        windText: 'ENE @ 11 mph, Gust 14 mph',
        airText: '49.9°F',
        waterText: '57.0°F',
        sunsetText: '19:42',
      });
    });

    it('cuts leading label text so wind speed and direction populate', () => {
      const input = normalizeWeatherText(
        'Pavilion telemetry — Wind NW @ 9 mph, Gust 21 mph, Air 52°F, Water 54°F, Sunset 18:15'
      );

      expect(parseMitSailingWeather(input).windText).toBe(
        'NW @ 9 mph, Gust 21 mph'
      );
    });

    it('returns all null segments for empty string', () => {
      expect(parseMitSailingWeather('')).toEqual({
        windText: null,
        airText: null,
        waterText: null,
        sunsetText: null,
      });
    });

    it('returns nulls when required anchors are missing', () => {
      expect(
        parseMitSailingWeather('something random without markers')
      ).toEqual({
        windText: null,
        airText: null,
        waterText: null,
        sunsetText: null,
      });
    });

    it('returns partial segments when sunset marker missing', () => {
      const input = 'Wind calm, Air 50°F, Water 55°F';
      expect(parseMitSailingWeather(normalizeWeatherText(input))).toEqual({
        windText: 'calm',
        airText: '50°F',
        waterText: '55°F',
        sunsetText: null,
      });
    });

    it('parses after normalize fixes broken line endings', () => {
      const raw =
        'Wind E @ 5 mph,\r\nGust 6 mph,\r\nAir 40°F,\r\nWater 50°F,\r\nSunset 17:30';
      const normalized = normalizeWeatherText(raw);
      expect(parseMitSailingWeather(normalized)).toEqual({
        windText: 'E @ 5 mph, Gust 6 mph',
        airText: '40°F',
        waterText: '50°F',
        sunsetText: '17:30',
      });
    });
  });

  describe('formatWindMphToKnotsForDisplay', () => {
    it('rewrites statute mph values to rounded whole knots while preserving direction wording', () => {
      expect(formatWindMphToKnotsForDisplay('ENE @ 11 mph, Gust 16 mph')).toBe(
        'ENE @ 10 knots, Gust 14 knots'
      );
    });

    it('passes calm and other non mph wind lines through', () => {
      expect(formatWindMphToKnotsForDisplay('calm')).toBe('calm');
      expect(formatWindMphToKnotsForDisplay(null)).toBeNull();
    });
  });

  describe('formatSunsetTo12Hour', () => {
    it('converts canonical 24-hour MIT sunset strings to lowercase am/pm copy', () => {
      expect(formatSunsetTo12Hour('19:42')).toBe('7:42pm');
      expect(formatSunsetTo12Hour('7:05')).toBe('7:05am');
      expect(formatSunsetTo12Hour('12:30')).toBe('12:30pm');
      expect(formatSunsetTo12Hour('00:15')).toBe('12:15am');
    });

    it('returns null when input is absent or whitespace', () => {
      expect(formatSunsetTo12Hour(null)).toBeNull();
      expect(formatSunsetTo12Hour('   ')).toBeNull();
    });

    it('passes through non-HMM-style strings once tag noise is removed', () => {
      expect(formatSunsetTo12Hour('n/a')).toBe('n/a');
    });

    it('extracts clock time when upstream leaves closing anchor junk on the segment', () => {
      expect(formatSunsetTo12Hour('19:42</a>')).toBe('7:42pm');
    });

    it('drops unclosed angle-bracket junk after the clock so sanitization is complete', () => {
      expect(formatSunsetTo12Hour('19:42<script')).toBe('7:42pm');
    });
  });

  describe('toDisplayWeatherSegments', () => {
    it('formats sunset as 12h and converts statute mph winds to knots for display', () => {
      const parsed = normalizeWeatherText(
        'Wind calm, Air 50°F, Water 55°F, Sunset 19:42'
      );
      const raw = parseMitSailingWeather(parsed);
      expect(toDisplayWeatherSegments(raw).sunsetText).toBe('7:42pm');
      expect(toDisplayWeatherSegments(raw).windText).toBe('calm');
    });

    it('converts gust and sustained mph on the wind line', () => {
      const parsed = parseMitSailingWeather(
        normalizeWeatherText(
          'Wind ENE @ 11 mph, Gust 14 mph, Air 50°F, Water 55°F, Sunset 18:30'
        )
      );
      expect(toDisplayWeatherSegments(parsed).windText).toBe(
        'ENE @ 10 knots, Gust 12 knots'
      );
    });
  });
});
