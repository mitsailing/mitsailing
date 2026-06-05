import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { SailingCardPdfData } from './sailingCardPdf';
import {
  generateSailingCardPdf,
  sailingCardClassYearLabel,
  sailingCardDateLabel,
  sailingCardPdfLayout,
  sailingCardRatingLabels,
  sailingCardYearLabel,
} from './sailingCardPdf';

const onePixelPng = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )
);

function sailingCardPdfData(): SailingCardPdfData {
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
    affiliation: 'Affiliation',
    cardNumber: 'Card #61',
    class: 'Class',
    date: 'DATE',
    email: 'Email',
    expires: 'Expiration',
    membership: 'Membership',
    noRatings: 'No ratings earned',
    notTransferable: 'NOT TRANSFERABLE',
    pavilionName: 'MIT Sailing Pavilion',
    phone: 'Phone',
    signature: 'MEMBER SIGNATURE',
  };
}

function textByValue(
  layout: ReturnType<typeof sailingCardPdfLayout>,
  value: string
) {
  return layout.text.filter((text) => text.text === value);
}

function sailingCardPdfLayoutFixture(
  data: ReturnType<typeof sailingCardPdfData> = sailingCardPdfData()
) {
  return sailingCardPdfLayout({
    data,
    labels: sailingCardPdfLabels(),
  });
}

describe('sailingCardPdf', () => {
  it('formats class years like the legacy card', () => {
    expect(sailingCardClassYearLabel('2027')).toBe("'2027");
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

  it('formats ratings consistently across both card sides', () => {
    expect(
      sailingCardRatingLabels([
        { level: '0', name: 'Swim' },
        { level: '1', name: 'Tech' },
        { level: 'basic', name: 'Tech Dinghy' },
        { level: 'advanced', name: 'Firefly' },
        { level: '3', name: 'Laser: Advanced' },
        { level: '3', name: '420: Basic' },
        { level: '3', name: 'Firefly Advanced' },
        { level: '3', name: 'Firefly Basic' },
        { level: null, name: 'Keelboat' },
      ])
    ).toEqual({
      main: [
        'Swim',
        'Tech',
        'Tech Dinghy: Basic',
        'Firefly: Adv',
        'Laser: Adv',
        '420: Basic',
        'Firefly: Adv',
        'Firefly: Basic',
        'Keelboat',
      ],
      small: [
        'Swim',
        'Tech',
        'Tech Dinghy: Basic',
        'Firefly: Adv',
        'Laser: Adv',
        '420: Basic',
        'Firefly: Adv',
        'Firefly: Basic',
        'Keelboat',
      ],
    });
  });

  it('positions card numbers on both sides', () => {
    const layout = sailingCardPdfLayoutFixture();

    expect(textByValue(layout, '61')).toEqual([
      expect.objectContaining({
        font: 'bold',
        size: 18,
        text: '61',
        x: 0.1,
        y: 0.25,
      }),
      expect.objectContaining({
        align: 'right',
        font: 'bold',
        rightX: 7.1,
        size: 18,
        text: '61',
        y: 0.17,
      }),
    ]);
  });

  it('groups season and names with legacy spacing', () => {
    const layout = sailingCardPdfLayoutFixture();

    expect(textByValue(layout, '2026-2027')).toEqual([
      expect.objectContaining({
        align: 'right',
        font: 'regular',
        maxWidth: 1.85,
        text: '2026-2027',
        x: 0.55,
        y: 0.2,
      }),
      expect.objectContaining({
        font: 'regular',
        text: '2026-2027',
        x: 6.4,
        y: 0.445,
      }),
    ]);
    expect(layout.text).toContainEqual(
      expect.objectContaining({
        align: 'right',
        baselineOffset: 0.16,
        font: 'serifBold',
        maxWidth: 2.25,
        text: 'Grace Hopper',
        x: 0.15,
        y: 0.3,
      })
    );
    expect(layout.text).toContainEqual(
      expect.objectContaining({
        font: 'serifBold',
        maxWidth: 3.8,
        size: 18,
        text: 'Hopper, Grace',
        x: 2.7,
        y: 0.05,
      })
    );
  });

  it('places member details in legacy columns', () => {
    const layout = sailingCardPdfLayoutFixture();

    expect(layout.text).toContainEqual(
      expect.objectContaining({
        font: 'bold',
        text: '(617) 253-0000',
        x: 4.2,
        y: 0.7,
      })
    );
    expect(layout.text).toContainEqual(
      expect.objectContaining({
        font: 'bold',
        text: "'2027",
        x: 4.2,
        y: 1.06,
      })
    );
  });

  it('omits labels replaced by the legacy layout', () => {
    const layout = sailingCardPdfLayoutFixture();

    expect(layout.text).not.toContainEqual(
      expect.objectContaining({ text: 'MIT Sailing Pavilion' })
    );
    expect(layout.text).not.toContainEqual(
      expect.objectContaining({ text: '#61  2026-2027' })
    );
  });

  it('places signature lines and images', () => {
    const layout = sailingCardPdfLayoutFixture();

    expect(layout.lines).toContainEqual({
      endX: 5.5,
      startX: 2.75,
      thickness: 0.65,
      y: 2.6,
    });
    expect(layout.images).toEqual([
      { height: 0.99, image: 'burgee', width: 1.5, x: 0.4, y: 0.65 },
      { height: 0.17, image: 'mit', width: 0.3, x: 0.2, y: 2.66 },
      { height: 0.99, image: 'burgee', width: 1.5, x: 3, y: 0.6 },
      { height: 0.23, image: 'mit', width: 0.4, x: 6.7, y: 2.54 },
    ]);
  });

  it('prints blank optional member fields', () => {
    const layout = sailingCardPdfLayoutFixture({
      ...sailingCardPdfData(),
      classYear: null,
      email: null,
      phone: null,
    });

    expect(layout.text).toContainEqual(
      expect.objectContaining({ text: '', x: 4.2, y: 0.7 })
    );
    expect(layout.text).toContainEqual(
      expect.objectContaining({ text: '', x: 4.2, y: 0.88 })
    );
    expect(layout.text).toContainEqual(
      expect.objectContaining({ text: '', x: 4.2, y: 1.06 })
    );
  });

  it('prints a no-ratings fallback on both sides', () => {
    const layout = sailingCardPdfLayoutFixture({
      ...sailingCardPdfData(),
      ratings: [],
    });

    expect(textByValue(layout, 'No ratings earned')).toEqual([
      expect.objectContaining({
        font: 'italic',
        size: 9,
        text: 'No ratings earned',
        x: 0.3,
        y: 1.25,
      }),
      expect.objectContaining({
        font: 'italic',
        size: 9,
        text: 'No ratings earned',
        x: 3,
        y: 2.45,
      }),
    ]);
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
