import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Permission } from '@/libs/auth/permissions';
import { GET } from './route';

const mocks = vi.hoisted(() => ({
  generateSailingCardPdf: vi.fn(),
  getTranslations: vi.fn(),
  getSailingCardPdfData: vi.fn(),
  loadSailingCardPdfAssets: vi.fn(),
  loggerError: vi.fn(),
  requirePermission: vi.fn(),
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

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTranslations.mockResolvedValue(
    (key: string, values?: { readonly cardNumber?: number }) => {
      if (values?.cardNumber !== undefined) {
        return `AdminUsers.${key}.${values.cardNumber}`;
      }

      return `AdminUsers.${key}`;
    }
  );
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

  it('passes translated labels into the PDF generator', async () => {
    await GET(new Request('https://example.test/pdf'), {
      params: Promise.resolve({ id: 'user-1' }),
    });

    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'AdminUsers',
    });
    expect(mocks.generateSailingCardPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        labels: {
          affiliation: 'AdminUsers.sailing_card_pdf_affiliation',
          cardNumber: 'AdminUsers.sailing_card_pdf_card_number.61',
          class: 'AdminUsers.sailing_card_pdf_class',
          date: 'AdminUsers.sailing_card_pdf_date',
          email: 'AdminUsers.sailing_card_pdf_email',
          expires: 'AdminUsers.sailing_card_pdf_expires',
          membership: 'AdminUsers.sailing_card_pdf_membership',
          noRatings: 'AdminUsers.sailing_card_pdf_no_ratings',
          notTransferable: 'AdminUsers.sailing_card_pdf_not_transferable',
          pavilionName: 'AdminUsers.sailing_card_pdf_pavilion_name',
          phone: 'AdminUsers.sailing_card_pdf_phone',
          signature: 'AdminUsers.sailing_card_pdf_signature',
        },
      })
    );
  });

  it('logs PDF generation failures through logger', async () => {
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
        action: 'generate',
        adminUserId: 'admin-1',
        cardNumber: 61,
        cardYear: 2026,
        error,
        feature: 'sailing-card-pdf',
        targetUserId: 'user-1',
      })
    );
  });
});
