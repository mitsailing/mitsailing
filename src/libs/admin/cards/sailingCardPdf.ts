import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { nyYmd } from '@/lib/mit-sailing/nyTime';

const POINTS_PER_INCH = 72;
const CARD_WIDTH_INCHES = 7.25;
const CARD_HEIGHT_INCHES = 3;

export type SailingCardPdfAssets = {
  readonly burgee: Uint8Array;
  readonly mit: Uint8Array;
};

export type SailingCardPdfRating = {
  readonly level: string | null;
  readonly name: string;
};

export type SailingCardPdfData = {
  readonly affiliationLabel: string;
  readonly cardNumber: number;
  readonly cardTypeLabel: string;
  readonly cardYear: number;
  readonly classYear: string | null;
  readonly email: string | null;
  readonly expiresOn: Date;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly ratings: readonly SailingCardPdfRating[];
  readonly userId: string;
};

export type SailingCardPdfLabels = {
  readonly affiliation: string;
  readonly cardNumber: string;
  readonly class: string;
  readonly date: string;
  readonly email: string;
  readonly expires: string;
  readonly membership: string;
  readonly notTransferable: string;
  readonly pavilionName: string;
  readonly phone: string;
  readonly signature: string;
};

type SailingCardPdfText = {
  readonly size?: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
};

type SailingCardPdfOptions = {
  readonly assets: SailingCardPdfAssets;
  readonly data: SailingCardPdfData;
  readonly labels: SailingCardPdfLabels;
};

export function sailingCardClassYearLabel(classYear: string | null) {
  return classYear ?? '';
}

export function sailingCardYearLabel(cardYear: number) {
  return `${cardYear}-${cardYear + 1}`;
}

function ratingLevelSuffix(level: string | null) {
  if (level === null) {
    return null;
  }

  const normalizedLevel = level.toLowerCase();
  if (normalizedLevel === 'advanced') {
    return 'Adv';
  }
  if (normalizedLevel === 'basic') {
    return 'Basic';
  }

  return level;
}

function normalizedBasicAdvancedRating(rating: SailingCardPdfRating) {
  const advancedMatch = /^(.+?)(?::?\s+advanced)$/i.exec(rating.name);
  const advancedName = advancedMatch?.[1];
  if (advancedName) {
    return { name: advancedName, suffix: 'Adv' };
  }

  const basicMatch = /^(.+?)(?::?\s+basic)$/i.exec(rating.name);
  const basicName = basicMatch?.[1];
  if (basicName) {
    return { name: basicName, suffix: 'Basic' };
  }

  return {
    name: rating.name,
    suffix: ratingLevelSuffix(rating.level),
  };
}

export function sailingCardRatingLabels(
  ratings: readonly SailingCardPdfRating[]
) {
  const main: string[] = [];
  const small: string[] = [];

  for (const rating of ratings) {
    const normalizedRating = normalizedBasicAdvancedRating(rating);
    const mainLabel =
      normalizedRating.suffix === null
        ? normalizedRating.name
        : `${normalizedRating.name}: ${normalizedRating.suffix}`;
    let smallLabel = normalizedRating.name;

    if (
      normalizedRating.suffix !== null &&
      normalizedRating.suffix !== 'Basic'
    ) {
      smallLabel = `${normalizedRating.name}: ${normalizedRating.suffix}`;
    }

    main.push(mainLabel);
    small.push(smallLabel);
  }

  return { main, small };
}

function points(inches: number) {
  return inches * POINTS_PER_INCH;
}

function yFromTop(y: number) {
  return points(CARD_HEIGHT_INCHES - y);
}

export function sailingCardDateLabel(date: Date) {
  return nyYmd(date);
}

function drawText(
  page: ReturnType<PDFDocument['addPage']>,
  props: SailingCardPdfText & {
    readonly font: Awaited<ReturnType<PDFDocument['embedFont']>>;
  }
) {
  page.drawText(props.text, {
    x: points(props.x),
    y: yFromTop(props.y),
    size: props.size ?? 8,
    font: props.font,
    color: rgb(0, 0, 0),
  });
}

export async function generateSailingCardPdf(props: SailingCardPdfOptions) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([
    points(CARD_WIDTH_INCHES),
    points(CARD_HEIGHT_INCHES),
  ]);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const burgeeImage = await pdf.embedPng(props.assets.burgee);
  const mitImage = await pdf.embedPng(props.assets.mit);
  const yearLabel = sailingCardYearLabel(props.data.cardYear);
  const expiresLabel = sailingCardDateLabel(props.data.expiresOn);
  const classYear = sailingCardClassYearLabel(props.data.classYear);
  const ratingLabels = sailingCardRatingLabels(props.data.ratings);

  page.drawImage(burgeeImage, {
    x: points(0.4),
    y: yFromTop(1.25),
    width: points(0.6),
    height: points(0.4),
  });
  page.drawImage(mitImage, {
    x: points(0.2),
    y: yFromTop(2.88),
    width: points(0.3),
    height: points(0.17),
  });
  page.drawImage(burgeeImage, {
    x: points(3),
    y: yFromTop(1.25),
    width: points(0.9),
    height: points(0.6),
  });
  page.drawImage(mitImage, {
    x: points(6.7),
    y: yFromTop(2.88),
    width: points(0.4),
    height: points(0.23),
  });

  drawText(page, {
    font: boldFont,
    size: 9,
    text: props.labels.pavilionName,
    x: 0.25,
    y: 0.25,
  });
  drawText(page, {
    font: regularFont,
    text: props.labels.cardNumber,
    x: 0.25,
    y: 0.48,
  });
  drawText(page, { font: regularFont, text: yearLabel, x: 1.75, y: 0.48 });
  drawText(page, {
    font: boldFont,
    size: 10,
    text: `${props.data.firstName} ${props.data.lastName}`,
    x: 0.25,
    y: 0.83,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.expires}: ${expiresLabel}`,
    x: 0.25,
    y: 1.18,
  });
  drawText(page, {
    font: regularFont,
    text: props.data.affiliationLabel,
    x: 0.25,
    y: 1.38,
  });
  drawText(page, {
    font: regularFont,
    text: props.data.cardTypeLabel,
    x: 0.25,
    y: 1.58,
  });
  for (const [index, rating] of ratingLabels.small.entries()) {
    drawText(page, {
      font: regularFont,
      text: rating,
      x: 0.25 + Math.floor(index / 6) * 1.25,
      y: 1.87 + (index % 6) * 0.18,
    });
  }
  drawText(page, {
    font: boldFont,
    size: 7,
    text: props.labels.notTransferable,
    x: 1.1,
    y: 2.83,
  });

  drawText(page, {
    font: boldFont,
    size: 11,
    text: props.data.lastName,
    x: 3,
    y: 0.25,
  });
  drawText(page, {
    font: boldFont,
    size: 11,
    text: props.data.firstName,
    x: 4.9,
    y: 0.25,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.expires}: ${expiresLabel}`,
    x: 3,
    y: 0.62,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.affiliation}: ${props.data.affiliationLabel}`,
    x: 3,
    y: 0.82,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.membership}: ${props.data.cardTypeLabel}`,
    x: 3,
    y: 1.02,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.phone}: ${props.data.phone ?? ''}`,
    x: 4.4,
    y: 0.62,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.email}: ${props.data.email ?? ''}`,
    x: 4.4,
    y: 0.82,
  });
  drawText(page, {
    font: regularFont,
    text: `${props.labels.class}: ${classYear}`,
    x: 4.4,
    y: 1.02,
  });
  drawText(page, {
    font: boldFont,
    text: `#${props.data.cardNumber}  ${yearLabel}`,
    x: 5.9,
    y: 0.62,
  });
  drawText(page, {
    font: regularFont,
    text: props.labels.signature,
    x: 3,
    y: 1.65,
  });
  drawText(page, {
    font: regularFont,
    text: props.labels.date,
    x: 5.6,
    y: 1.65,
  });
  page.drawLine({
    start: { x: points(3), y: yFromTop(1.54) },
    end: { x: points(5.2), y: yFromTop(1.54) },
    thickness: 0.5,
  });
  page.drawLine({
    start: { x: points(5.6), y: yFromTop(1.54) },
    end: { x: points(6.8), y: yFromTop(1.54) },
    thickness: 0.5,
  });
  for (const [index, rating] of ratingLabels.main.entries()) {
    drawText(page, {
      font: regularFont,
      text: rating,
      x: 3 + Math.floor(index / 4) * 1.45,
      y: 2 + (index % 4) * 0.18,
    });
  }

  return pdf.save();
}
