import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  generateSailingCardPdf: vi.fn(),
  getSailingCardPdfData: vi.fn(),
  loadSailingCardPdfAssets: vi.fn(),
  loggerError: vi.fn(),
  requirePermission: vi.fn(),
}));

vi.mock('@sentry/nextjs', () => ({
  captureException: mocks.captureException,
}));

vi.mock('@/libs/admin/cards/sailingCardPdf', () => ({
  generateSailingCardPdf: mocks.generateSailingCardPdf,
}));

vi.mock('@/libs/admin/cards/sailingCardPdfData', () => ({
  getSailingCardPdfData: mocks.getSailingCardPdfData,
  loadSailingCardPdfAssets: mocks.loadSailingCardPdfAssets,
}));

vi.mock('@/libs/auth/dal', () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/Logger', () => ({
  logger: { error: mocks.loggerError },
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requirePermission.mockResolvedValue({
    user: { id: 'admin-1' },
  });
  mocks.getSailingCardPdfData.mockResolvedValue({
    cardNumber: 61,
    cardYear: 2026,
    userId: 'user-1',
  });
  mocks.loadSailingCardPdfAssets.mockResolvedValue({
    burgee: new Uint8Array([1]),
    mit: new Uint8Array([2]),
  });
  mocks.generateSailingCardPdf.mockResolvedValue(
    new TextEncoder().encode('%PDF-test')
  );
});

describe('sailing card PDF route', () => {
  it('requires card print permission', async () => {
    await GET(new Request('https://example.test/pdf'), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.CARDS_PRINT
    );
  });

  it('returns PDF bytes without embedding auto-print behavior', async () => {
    const response = await GET(new Request('https://example.test/pdf'), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-disposition')).toContain(
      'sailing-card-2026-61.pdf'
    );
    await expect(response.text()).resolves.toBe('%PDF-test');
  });

  it('reports PDF generation failures to Sentry', async () => {
    const error = new Error('pdf failed');
    mocks.generateSailingCardPdf.mockRejectedValue(error);

    const response = await GET(new Request('https://example.test/pdf'), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'pdf_generation_failed',
    });
    expect(mocks.loggerError).toHaveBeenCalledWith(
      'Failed to generate sailing-card PDF: {error}',
      expect.objectContaining({
        adminUserId: 'admin-1',
        cardNumber: 61,
        cardYear: 2026,
        error,
        targetUserId: 'user-1',
      })
    );
    expect(mocks.captureException).toHaveBeenCalledWith(
      error,
      expect.objectContaining({
        contexts: {
          sailingCardPdf: expect.objectContaining({
            adminUserId: 'admin-1',
            cardNumber: 61,
            cardYear: 2026,
            targetUserId: 'user-1',
          }),
        },
        tags: {
          action: 'generate',
          feature: 'sailing-card-pdf',
        },
      })
    );
  });
});
