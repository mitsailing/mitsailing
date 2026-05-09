import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MockInstance } from 'vitest';

const mockWarn = vi.hoisted(() => vi.fn());
const mockError = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));

vi.mock('@/libs/Logger', () => ({
  logger: {
    warn: mockWarn,
    error: mockError,
    info: vi.fn(),
  },
}));

describe('fetchWeatherHeaderData', () => {
  let fetchSpy: MockInstance<(typeof globalThis)['fetch']>;

  beforeEach(() => {
    vi.resetModules();
    mockWarn.mockClear();
    mockError.mockClear();
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    vi.useRealTimers();
    fetchSpy.mockRestore();
  });

  it('parses 200 body, formats sunset to 12-hour, and skips warning when quartet is complete', async () => {
    const htmlBody = `<!doctype html><html><body><div class="w"><p>Wind ENE @ 11 mph, Gust 14 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42</p></div></body></html>`;
    fetchSpy.mockResolvedValue(
      new Response(htmlBody, {
        headers: {
          'Last-Modified': 'Wed, 01 Jan 2025 00:00:00 GMT',
        },
        status: 200,
      })
    );

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(false);
    expect(result.windText).toBe('ENE @ 10 knots, Gust 12 knots');
    expect(result.sunsetText).toBe('7:42pm');
    expect(result.sourceTimestamp).toBe('Wed, 01 Jan 2025 00:00:00 GMT');
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
    expect(fetchSpy.mock.calls[0]?.[1]).not.toHaveProperty('next');
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it('serves cached weather from server memory until the 15-minute ttl expires', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));

    fetchSpy
      .mockResolvedValueOnce(
        new Response(
          'Wind ENE @ 11 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42',
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response('Wind W @ 8 mph, Air 55.0°F, Water 58.0°F, Sunset 19:45', {
          status: 200,
        })
      );

    const { fetchWeatherHeaderData } = await import('@/lib/weather');

    const first = await fetchWeatherHeaderData();
    const second = await fetchWeatherHeaderData();

    expect(first.windText).toBe('ENE @ 10 knots');
    expect(second.windText).toBe('ENE @ 10 knots');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-05-08T12:14:59.999Z'));

    const beforeExpiry = await fetchWeatherHeaderData();

    expect(beforeExpiry.windText).toBe('ENE @ 10 knots');
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-05-08T12:15:00.001Z'));

    const afterExpiry = await fetchWeatherHeaderData();

    expect(afterExpiry.windText).toBe('W @ 7 knots');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('expires brownout cache before the full poll window so upstream retries sooner', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-08T12:00:00.000Z'));

    fetchSpy
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(
        new Response(
          'Wind ENE @ 11 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42',
          { status: 200 }
        )
      );

    const { fetchWeatherHeaderData } = await import('@/lib/weather');

    const brownout = await fetchWeatherHeaderData();
    expect(brownout.isFallback).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-05-08T12:00:59.999Z'));
    const stillCached = await fetchWeatherHeaderData();
    expect(stillCached.isFallback).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date('2026-05-08T12:01:00.001Z'));
    const recovered = await fetchWeatherHeaderData();
    expect(recovered.isFallback).toBe(false);
    expect(recovered.windText).toBe('ENE @ 10 knots');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shares one upstream request for concurrent cache misses', async () => {
    const pendingFetch = Promise.withResolvers<Response>();
    fetchSpy.mockReturnValue(pendingFetch.promise);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');

    const first = fetchWeatherHeaderData();
    const second = fetchWeatherHeaderData();

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    pendingFetch.resolve(
      new Response(
        'Wind ENE @ 11 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42',
        { status: 200 }
      )
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toEqual(secondResult);
    expect(firstResult.windText).toBe('ENE @ 10 knots');
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('uses Date as source timestamp when Last-Modified is missing', async () => {
    const body = 'Wind ENE @ 11 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42';
    fetchSpy.mockResolvedValue(
      new Response(body, {
        headers: {
          Date: 'Thu, 02 Jan 2025 00:00:00 GMT',
        },
        status: 200,
      })
    );

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(false);
    expect(result.sourceTimestamp).toBe('Thu, 02 Jan 2025 00:00:00 GMT');
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('leaves source timestamp null when upstream sends no freshness headers', async () => {
    const body = 'Wind ENE @ 11 mph, Air 49.9°F, Water 57.0°F, Sunset 19:42';
    fetchSpy.mockResolvedValue(new Response(body, { status: 200 }));

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(false);
    expect(result.sourceTimestamp).toBeNull();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs parse warning when prepared upstream body is empty', async () => {
    fetchSpy.mockResolvedValue(new Response('<html></html>', { status: 200 }));

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result).toEqual({
      windText: null,
      airText: null,
      waterText: null,
      sunsetText: null,
      isFallback: true,
    });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0]?.[0]).toMatch(/reason=empty_body/u);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs incomplete quartet warning and returns partial display fields', async () => {
    fetchSpy.mockResolvedValue(
      new Response('Wind calm, Air 50°F, Water 55°F', {
        headers: {
          'Last-Modified': 'Fri, 03 Jan 2025 00:00:00 GMT',
        },
        status: 200,
      })
    );

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result).toEqual({
      windText: 'calm',
      airText: '50°F',
      waterText: '55°F',
      sunsetText: null,
      isFallback: true,
      sourceTimestamp: 'Fri, 03 Jan 2025 00:00:00 GMT',
    });
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0]?.[0]).toMatch(/reason=incomplete_quartet/u);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs one operational warn on non-OK without error-level noise', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(result.windText).toBeNull();
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const fetchWarnFirst = mockWarn.mock.calls[0]?.[0];
    expect(fetchWarnFirst).toBeDefined();
    expect(fetchWarnFirst).toMatch(/\[mit-weather:fetch\]/u);
    expect(fetchWarnFirst).toMatch(/status=503/u);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs warn on AbortError paths without error-level spam', async () => {
    const abortErr = Object.assign(new Error('Aborted'), {
      name: 'AbortError',
    });
    fetchSpy.mockRejectedValue(abortErr);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockWarn).toHaveBeenCalledTimes(1);
    const abortWarnFirst = mockWarn.mock.calls[0]?.[0];
    expect(abortWarnFirst).toBeDefined();
    expect(abortWarnFirst).toMatch(/timeout_or_abort/u);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs warn only for generic failures and returns fallback quartet', async () => {
    fetchSpy.mockRejectedValue(new TypeError('network down'));

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    const errWarnFirst = mockWarn.mock.calls[0]?.[0];
    expect(errWarnFirst).toBeDefined();
    expect(errWarnFirst).toMatch(/TypeError/u);
    expect(mockError).not.toHaveBeenCalled();
  });

  it('logs non-Error failures as string details', async () => {
    fetchSpy.mockRejectedValue('offline');

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(mockWarn).toHaveBeenCalledTimes(1);
    expect(mockWarn.mock.calls[0]?.[0]).toMatch(/message=offline/u);
    expect(mockError).not.toHaveBeenCalled();
  });
});
