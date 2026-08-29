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
    expect(fetchSpy.mock.calls[0]?.[1]).toEqual({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
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

  it('logs parse error when prepared upstream body is empty', async () => {
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
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0]?.[0]).toMatch(/reason=empty_body/u);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs incomplete quartet error and returns partial display fields', async () => {
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
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0]?.[0]).toMatch(/reason=incomplete_quartet/u);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs error on non-OK upstream status', async () => {
    fetchSpy.mockResolvedValue(new Response(null, { status: 503 }));

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(result.windText).toBeNull();
    expect(mockError).toHaveBeenCalledTimes(1);
    const fetchErrorFirst = mockError.mock.calls[0]?.[0];
    expect(fetchErrorFirst).toBeDefined();
    expect(fetchErrorFirst).toMatch(/\[mit-weather:fetch\]/u);
    expect(fetchErrorFirst).toMatch(/status=503/u);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs error on AbortError paths', async () => {
    const abortErr = Object.assign(new Error('Aborted'), {
      name: 'AbortError',
    });
    fetchSpy.mockRejectedValue(abortErr);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockError).toHaveBeenCalledTimes(1);
    const abortErrorFirst = mockError.mock.calls[0]?.[0];
    expect(abortErrorFirst).toBeDefined();
    expect(abortErrorFirst).toMatch(/timeout_or_abort/u);
    expect(mockError.mock.calls[0]?.[1]).toMatchObject({ error: abortErr });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs error for generic failures including cause fields and returns fallback', async () => {
    const networkError = new TypeError('fetch failed', {
      cause: Object.assign(
        new Error('unable to verify the first certificate'),
        {
          code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
        }
      ),
    });
    fetchSpy.mockRejectedValue(networkError);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(mockError).toHaveBeenCalledTimes(1);
    const [errPayload] = mockError.mock.calls;
    expect(errPayload?.[0]).toMatch(/TypeError/u);
    expect(errPayload?.[1]).toMatchObject({
      causeCode: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
      error: networkError,
    });
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs non-Error failures as string details', async () => {
    fetchSpy.mockRejectedValue('offline');

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    const result = await fetchWeatherHeaderData();

    expect(result.isFallback).toBe(true);
    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0]?.[0]).toMatch(/message=offline/u);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('logs timeout when the error message includes abort without AbortError name', async () => {
    const abortErr = new Error('The operation was aborted');
    fetchSpy.mockRejectedValue(abortErr);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockError).toHaveBeenCalledTimes(1);
    expect(mockError.mock.calls[0]?.[0]).toMatch(/timeout_or_abort/u);
    expect(mockError.mock.calls[0]?.[1]).toMatchObject({ error: abortErr });
  });

  it('logs generic Error failures without a cause', async () => {
    const networkError = new Error('fetch failed');
    fetchSpy.mockRejectedValue(networkError);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockError.mock.calls[0]?.[0]).toMatch(/Error: fetch failed/u);
    expect(mockError.mock.calls[0]?.[1]).toMatchObject({ error: networkError });
    expect(mockError.mock.calls[0]?.[1]).not.toHaveProperty('causeMessage');
  });

  it('logs string causes and numeric cause codes', async () => {
    const stringCauseError = new TypeError('fetch failed', {
      cause: 'certificate expired',
    });
    fetchSpy.mockRejectedValueOnce(stringCauseError);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockError.mock.calls[0]?.[1]).toMatchObject({
      causeMessage: 'certificate expired',
      error: stringCauseError,
    });

    mockError.mockClear();
    const numericCause = new TypeError('fetch failed', {
      cause: Object.assign(new Error('reset'), { code: 104 }),
    });
    fetchSpy.mockRejectedValueOnce(numericCause);
    vi.resetModules();
    const { fetchWeatherHeaderData: fetchAgain } =
      await import('@/lib/weather');
    await fetchAgain();

    expect(mockError.mock.calls[0]?.[1]).toMatchObject({
      causeCode: '104',
      causeMessage: 'reset',
      error: numericCause,
    });
  });

  it('omits causeCode for Error causes without a code and ignores object causes', async () => {
    const causeWithoutCode = new TypeError('fetch failed', {
      cause: new Error('socket hang up'),
    });
    fetchSpy.mockRejectedValueOnce(causeWithoutCode);

    const { fetchWeatherHeaderData } = await import('@/lib/weather');
    await fetchWeatherHeaderData();

    expect(mockError.mock.calls[0]?.[1]).toMatchObject({
      causeMessage: 'socket hang up',
      error: causeWithoutCode,
    });
    expect(mockError.mock.calls[0]?.[1]).not.toHaveProperty('causeCode');

    mockError.mockClear();
    const objectCause = new TypeError('fetch failed', {
      cause: { reason: 'blocked' },
    });
    fetchSpy.mockRejectedValueOnce(objectCause);
    vi.resetModules();
    const { fetchWeatherHeaderData: fetchAgain } =
      await import('@/lib/weather');
    await fetchAgain();

    expect(mockError.mock.calls[0]?.[1]).toMatchObject({ error: objectCause });
    expect(mockError.mock.calls[0]?.[1]).not.toHaveProperty('causeMessage');
  });
});
