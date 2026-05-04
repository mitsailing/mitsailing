import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAdminUploadListPage,
  parseAdminUploadListResponse,
} from '@/components/mit-sailing/admin/catalog/adminRichTextMediaLibrary';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseAdminUploadListResponse', () => {
  it('returns items and next cursor for a valid payload', () => {
    const parsed = {
      items: [
        {
          id: 'u1',
          url: '/api/uploads/2026/1/a.jpg',
          mimeType: 'image/jpeg',
          byteSize: 1024,
          createdAt: '2026-05-04T12:00:00.000Z',
        },
      ],
      nextCursor: 'cursor-token',
    };
    expect(parseAdminUploadListResponse(parsed)).toEqual({
      items: [
        {
          id: 'u1',
          url: '/api/uploads/2026/1/a.jpg',
          mimeType: 'image/jpeg',
          byteSize: 1024,
          createdAt: '2026-05-04T12:00:00.000Z',
        },
      ],
      nextCursor: 'cursor-token',
    });
  });

  it('accepts empty items with null next cursor', () => {
    expect(
      parseAdminUploadListResponse({ items: [], nextCursor: null })
    ).toEqual({ items: [], nextCursor: null });
  });

  it('accepts empty items when next cursor omitted', () => {
    expect(parseAdminUploadListResponse({ items: [] })).toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it('returns null when a row is not an object', () => {
    expect(
      parseAdminUploadListResponse({
        items: ['not-an-object'],
        nextCursor: null,
      })
    ).toBeNull();
  });

  it('returns null when a row misses required string fields', () => {
    expect(
      parseAdminUploadListResponse({
        items: [
          {
            id: 'u1',
            url: '/x',
            mimeType: 'image/jpeg',
            byteSize: 1,
            // createdAt missing
          },
        ],
        nextCursor: null,
      })
    ).toBeNull();
  });

  it('returns null when byte size is not a number', () => {
    expect(
      parseAdminUploadListResponse({
        items: [
          {
            id: 'u1',
            url: '/x',
            mimeType: 'image/jpeg',
            byteSize: '1024',
            createdAt: '2026-05-04T12:00:00.000Z',
          },
        ],
        nextCursor: null,
      })
    ).toBeNull();
  });

  it('returns null when next cursor has wrong type', () => {
    expect(
      parseAdminUploadListResponse({
        items: [],
        nextCursor: 123,
      })
    ).toBeNull();
  });

  it('returns null when items is not an array', () => {
    expect(
      parseAdminUploadListResponse({
        items: {},
        nextCursor: null,
      })
    ).toBeNull();
  });

  it('returns null when payload is not an object', () => {
    expect(parseAdminUploadListResponse(null)).toBeNull();
    expect(parseAdminUploadListResponse('x')).toBeNull();
    expect(parseAdminUploadListResponse([])).toBeNull();
  });
});

describe('fetchAdminUploadListPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  it('calls uploads api with credentials and limit', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      Response.json({ items: [], nextCursor: null }, { status: 200 })
    );

    await fetchAdminUploadListPage(null);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [call0] = fetchMock.mock.calls;
    expect(call0).toBeDefined();
    if (!call0) {
      throw new Error('expected fetch call');
    }
    const [url, init] = call0;
    expect(url).toContain('/api/admin/uploads');
    expect(url).toContain('limit=24');
    expect(url).not.toMatch(/[?&]cursor=/);
    expect(init?.credentials).toBe('include');
  });

  it('adds cursor param when cursor is non-null', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      Response.json({ items: [], nextCursor: null }, { status: 200 })
    );

    await fetchAdminUploadListPage('abc123');

    const [call0] = fetchMock.mock.calls;
    expect(call0).toBeDefined();
    if (!call0) {
      throw new Error('expected fetch call');
    }
    const [url] = call0;
    expect(url).toContain('/api/admin/uploads');
    expect(url).toContain('cursor=abc123');
  });

  it('returns null when response is not ok', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(new Response('', { status: 500 }));

    await expect(fetchAdminUploadListPage(null)).resolves.toBeNull();
  });

  it('returns null when json body fails parse validation', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    fetchMock.mockResolvedValue(
      Response.json({ items: 'not-array', nextCursor: null }, { status: 200 })
    );

    await expect(fetchAdminUploadListPage(null)).resolves.toBeNull();
  });

  it('returns parsed payload when response is ok', async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const body = {
      items: [
        {
          id: 'u1',
          url: '/api/uploads/x',
          mimeType: 'image/png',
          byteSize: 10,
          createdAt: '2026-05-04T00:00:00.000Z',
        },
      ],
      nextCursor: 'next',
    };
    fetchMock.mockResolvedValue(Response.json(body, { status: 200 }));

    await expect(fetchAdminUploadListPage(null)).resolves.toEqual(body);
  });
});
