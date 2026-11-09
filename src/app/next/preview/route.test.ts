import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  disable: vi.fn(),
  enable: vi.fn(),
  error: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  secretMatches: vi.fn(),
}));

vi.mock('next/headers', () => ({
  draftMode: () => ({
    disable: mocks.disable,
    enable: mocks.enable,
    isEnabled: false,
  }),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('@/libs/payload/getPayloadClient', () => ({
  getPayloadClient: () => ({
    auth: mocks.auth,
    logger: { error: mocks.error },
  }),
}));

vi.mock('@/libs/payload/previewSecret', () => ({
  payloadPreviewSecretMatches: mocks.secretMatches,
}));

function request(query: string) {
  return new Request(`http://localhost:3000/next/preview?${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.secretMatches.mockImplementation(
    (value: null | string) => value === 'secret'
  );
  mocks.auth.mockResolvedValue({ user: null });
});

describe('GET /next/preview', () => {
  it('rejects a missing or wrong preview secret', async () => {
    const response = await GET(request('path=/pavilion'));

    expect(response.status).toBe(403);
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it('rejects a signed request without a path', async () => {
    const response = await GET(request('previewSecret=secret'));

    expect(response.status).toBe(404);
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it('rejects a non-relative path', async () => {
    const response = await GET(
      request('previewSecret=secret&path=https://example.com')
    );

    expect(response.status).toBe(500);
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it('disables draft mode when the caller is logged out', async () => {
    const response = await GET(request('previewSecret=secret&path=/pavilion'));

    expect(response.status).toBe(403);
    expect(mocks.disable).toHaveBeenCalledOnce();
    expect(mocks.enable).not.toHaveBeenCalled();
  });

  it('enables draft mode and redirects a CMS user to the public path', async () => {
    mocks.auth.mockResolvedValue({ user: { id: 'staff-1' } });

    await expect(
      GET(request('previewSecret=secret&path=/pavilion'))
    ).rejects.toThrow('REDIRECT:/pavilion');
    expect(mocks.enable).toHaveBeenCalledOnce();
    expect(mocks.disable).not.toHaveBeenCalled();
  });
});
