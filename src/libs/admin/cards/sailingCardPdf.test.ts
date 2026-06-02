import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  generateSailingCardPdf,
  sailingCardClassYearLabel,
  sailingCardDateLabel,
  sailingCardRatingLabels,
  sailingCardYearLabel,
} from './sailingCardPdf';

const onePixelPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
);

function sailingCardPdfData() {
  return {
    affiliationLabel: 'MIT Student',
    cardNumber: 61,
    cardTypeLabel: 'Normal',
    cardYear: 2026,
    classYear: '2027',
    email: 'sailor@mit.edu',
    expiresOn: new Date('2027-07-15T04:00:00.000Z'),
    firstName: 'Grace',
    lastName: 'Hopper',
    phone: '(617) 253-0000',
    ratings: [
      { level: 'basic', name: 'Tech Dinghy' },
      { level: 'advanced', name: 'Firefly' },
    ],
    userId: 'user-1',
  };
}

function sailingCardPdfLabels() {
  return {
    affiliation: 'Translated affiliation',
    cardNumber: 'Translated card #{cardNumber}',
    class: 'Translated class',
    date: 'Translated date',
    email: 'Translated email',
    expires: 'Translated expires',
    membership: 'Translated membership',
    notTransferable: 'Translated not transferable',
    pavilionName: 'Translated pavilion',
    phone: 'Translated phone',
    signature: 'Translated signature',
  };
}

describe('sailingCardPdf', () => {
  it('keeps full class years on printed cards', () => {
    expect(sailingCardClassYearLabel('2027')).toBe('2027');
    expect(sailingCardClassYearLabel('G')).toBe('G');
    expect(sailingCardClassYearLabel(null)).toBe('');
  });

  it('formats the card year as a full season range', () => {
    expect(sailingCardYearLabel(2026)).toBe('2026-2027');
  });

  it('formats expiry dates in New York calendar days', () => {
    expect(sailingCardDateLabel(new Date('2027-07-15T03:59:59.000Z'))).toBe(
      '2027-07-14'
    );
    expect(sailingCardDateLabel(new Date('2027-07-15T04:00:00.000Z'))).toBe(
      '2027-07-15'
    );
  });

  it('formats ratings like the legacy card sides', () => {
    expect(
      sailingCardRatingLabels([
        { level: 'basic', name: 'Tech Dinghy' },
        { level: 'advanced', name: 'Firefly' },
        { level: '3', name: 'Firefly Advanced' },
        { level: '3', name: 'Firefly Basic' },
        { level: null, name: 'Keelboat' },
      ])
    ).toEqual({
      main: [
        'Tech Dinghy: Basic',
        'Firefly: Adv',
        'Firefly: Adv',
        'Firefly: Basic',
        'Keelboat',
      ],
      small: [
        'Tech Dinghy',
        'Firefly: Adv',
        'Firefly: Adv',
        'Firefly',
        'Keelboat',
      ],
    });
  });

  it('generates one legacy-sized PDF page with embedded images', async () => {
    const pdfBytes = await generateSailingCardPdf({
      assets: {
        burgee: onePixelPng,
        mit: onePixelPng,
      },
      data: sailingCardPdfData(),
      labels: sailingCardPdfLabels(),
    });

    const pdf = await PDFDocument.load(pdfBytes);
    const pages = pdf.getPages();
    expect(pages).toHaveLength(1);
    expect(pages[0]?.getWidth()).toBeCloseTo(7.25 * 72);
    expect(pages[0]?.getHeight()).toBeCloseTo(3 * 72);
  });
});
