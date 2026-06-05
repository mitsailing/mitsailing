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
  readonly noRatings: string;
  readonly notTransferable: string;
  readonly pavilionName: string;
  readonly phone: string;
  readonly signature: string;
};

type SailingCardPdfFontName =
  | 'bold'
  | 'italic'
  | 'regular'
  | 'serif'
  | 'serifBold';

export type SailingCardPdfText = {
  readonly align?: 'right';
  readonly baselineOffset?: number;
  readonly font: SailingCardPdfFontName;
  readonly maxWidth?: number;
  readonly renderOffsetX?: number;
  readonly rightX?: number;
  readonly size: number;
  readonly text: string;
  readonly x: number;
  readonly y: number;
};

type SailingCardPdfImage = {
  readonly height: number;
  readonly image: 'burgee' | 'mit';
  readonly width: number;
  readonly x: number;
  readonly y: number;
};

export type SailingCardPdfLine = {
  readonly endX: number;
  readonly startX: number;
  readonly thickness: number;
  readonly y: number;
};

export type SailingCardPdfLayout = {
  readonly images: readonly SailingCardPdfImage[];
  readonly lines: readonly SailingCardPdfLine[];
  readonly text: readonly SailingCardPdfText[];
};

type SailingCardPdfOptions = {
  readonly assets: SailingCardPdfAssets;
  readonly data: SailingCardPdfData;
  readonly labels: SailingCardPdfLabels;
};

type SailingCardPdfLayoutOptions = Omit<SailingCardPdfOptions, 'assets'>;

type SailingCardPdfEmbeddedFonts = Record<
  SailingCardPdfFontName,
  Awaited<ReturnType<PDFDocument['embedFont']>>
>;

export function sailingCardClassYearLabel(classYear: string | null) {
  if (classYear === null) {
    return '';
  }
  if (classYear === 'G') {
    return 'G';
  }

  return `'${classYear}`;
}

export function sailingCardYearLabel(cardYear: number) {
  return `${cardYear}-${cardYear + 1}`;
}

function ratingLevelSuffix(level: string | null) {
  const normalizedLevel = level?.toLowerCase();
  if (normalizedLevel === 'advanced') {
    return 'Adv';
  }
  if (normalizedLevel === 'basic') {
    return 'Basic';
  }

  return null;
}

function ratingNameWithoutTrailingSuffix(props: {
  readonly name: string;
  readonly suffix: 'advanced' | 'basic';
}) {
  const suffixStart = props.name.length - props.suffix.length;
  if (
    suffixStart <= 0 ||
    !props.name.toLowerCase().endsWith(props.suffix) ||
    !props.name.slice(0, suffixStart).endsWith(' ')
  ) {
    return null;
  }

  const prefix = props.name.slice(0, suffixStart).trimEnd();
  const name = prefix.endsWith(':') ? prefix.slice(0, -1).trimEnd() : prefix;
  return name.length > 0 ? name : null;
}

function normalizedBasicAdvancedRating(rating: SailingCardPdfRating) {
  const advancedName = ratingNameWithoutTrailingSuffix({
    name: rating.name,
    suffix: 'advanced',
  });
  if (advancedName) {
    return { name: advancedName, suffix: 'Adv' };
  }

  const basicName = ratingNameWithoutTrailingSuffix({
    name: rating.name,
    suffix: 'basic',
  });
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

    if (normalizedRating.suffix !== null) {
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
  props: SailingCardPdfText,
  fonts: SailingCardPdfEmbeddedFonts
) {
  const font = fonts[props.font];
  const renderOffsetX = props.renderOffsetX ?? 0;
  const rightX =
    (props.rightX ?? props.x + (props.maxWidth ?? 0)) + renderOffsetX;
  const x =
    props.align === 'right'
      ? points(rightX) - font.widthOfTextAtSize(props.text, props.size)
      : points(props.x + renderOffsetX);

  page.drawText(props.text, {
    x,
    y: yFromTop(props.y + (props.baselineOffset ?? 0)),
    size: props.size,
    font,
    color: rgb(0, 0, 0),
  });
}

function drawImage(
  page: ReturnType<PDFDocument['addPage']>,
  image: Awaited<ReturnType<PDFDocument['embedPng']>>,
  props: SailingCardPdfImage
) {
  page.drawImage(image, {
    x: points(props.x),
    y: yFromTop(props.y + props.height),
    width: points(props.width),
    height: points(props.height),
  });
}

function drawLine(
  page: ReturnType<PDFDocument['addPage']>,
  line: SailingCardPdfLine
) {
  const y = yFromTop(line.y);

  page.drawLine({
    start: { x: points(line.startX), y },
    end: { x: points(line.endX), y },
    thickness: line.thickness,
  });
}

function labelWithColon(label: string) {
  return `${label}:`;
}

export function sailingCardPdfLayout(
  props: SailingCardPdfLayoutOptions
): SailingCardPdfLayout {
  const yearLabel = sailingCardYearLabel(props.data.cardYear);
  const expiresLabel = sailingCardDateLabel(props.data.expiresOn);
  const classYear = sailingCardClassYearLabel(props.data.classYear);
  const ratingLabels = sailingCardRatingLabels(props.data.ratings);
  const cardNumber = String(props.data.cardNumber);
  const text: SailingCardPdfText[] = [
    {
      font: 'bold',
      size: 18,
      text: cardNumber,
      x: 0.1,
      y: 0.25,
    },
    {
      align: 'right',
      baselineOffset: 0.1,
      font: 'regular',
      maxWidth: 1.85,
      renderOffsetX: -0.05,
      size: 10,
      text: yearLabel,
      x: 0.55,
      y: 0.2,
    },
    {
      align: 'right',
      baselineOffset: 0.16,
      font: 'serifBold',
      maxWidth: 2.25,
      renderOffsetX: -0.05,
      size: 12,
      text: `${props.data.firstName} ${props.data.lastName}`,
      x: 0.15,
      y: 0.3,
    },
    {
      font: 'regular',
      size: 10,
      text: labelWithColon(props.labels.expires),
      x: 0.1,
      y: 2.24,
    },
    {
      font: 'bold',
      size: 10,
      text: expiresLabel,
      x: 1.1,
      y: 2.24,
    },
    {
      font: 'regular',
      size: 10,
      text: labelWithColon(props.labels.affiliation),
      x: 0.1,
      y: 2.42,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.affiliationLabel,
      x: 1.1,
      y: 2.42,
    },
    {
      font: 'regular',
      size: 10,
      text: labelWithColon(props.labels.membership),
      x: 0.1,
      y: 2.6,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.cardTypeLabel,
      x: 1.1,
      y: 2.6,
    },
    {
      font: 'serif',
      size: 8,
      text: props.labels.notTransferable,
      x: 1,
      y: 2.82,
    },
    {
      baselineOffset: 0.22,
      font: 'serifBold',
      maxWidth: 3.8,
      size: 18,
      text: `${props.data.lastName}, ${props.data.firstName}`,
      x: 2.7,
      y: 0.05,
    },
    {
      font: 'bold',
      size: 10,
      text: expiresLabel,
      x: 2.75,
      y: 0.7,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.affiliationLabel,
      x: 2.75,
      y: 0.88,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.cardTypeLabel,
      x: 2.75,
      y: 1.06,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.phone ?? '',
      x: 4.2,
      y: 0.7,
    },
    {
      font: 'bold',
      size: 10,
      text: props.data.email ?? '',
      x: 4.2,
      y: 0.88,
    },
    {
      font: 'bold',
      size: 10,
      text: classYear,
      x: 4.2,
      y: 1.06,
    },
    {
      align: 'right',
      baselineOffset: 0.13,
      font: 'bold',
      maxWidth: 1,
      rightX: 7.1,
      size: 18,
      text: cardNumber,
      x: 6.1,
      y: 0.17,
    },
    {
      font: 'regular',
      size: 10,
      text: yearLabel,
      x: 6.4,
      y: 0.445,
    },
    {
      font: 'serifBold',
      size: 8,
      text: props.labels.signature,
      x: 2.75,
      y: 2.7,
    },
    {
      font: 'serifBold',
      size: 8,
      text: props.labels.date,
      x: 5.6,
      y: 2.7,
    },
  ];

  if (ratingLabels.small.length === 0) {
    text.push({
      font: 'italic',
      size: 9,
      text: props.labels.noRatings,
      x: 0.3,
      y: 1.25,
    });
  }

  if (ratingLabels.main.length === 0) {
    text.push({
      font: 'italic',
      size: 9,
      text: props.labels.noRatings,
      x: 3,
      y: 2.45,
    });
  }

  for (const [index, rating] of ratingLabels.small.entries()) {
    text.push({
      font: 'italic',
      size: 9,
      text: rating,
      x: 0.1 + Math.floor(index / 9) * 1.2,
      y: 0.8 + (index % 9) * 0.15,
    });
  }

  for (const [index, rating] of ratingLabels.main.entries()) {
    text.push({
      font: 'italic',
      size: 9,
      text: rating,
      x: 2.75 + Math.floor(index / 6) * 1.5,
      y: 1.3 + (index % 6) * 0.15,
    });
  }

  return {
    images: [
      { height: 0.99, image: 'burgee', width: 1.5, x: 0.4, y: 0.65 },
      { height: 0.17, image: 'mit', width: 0.3, x: 0.2, y: 2.66 },
      { height: 0.99, image: 'burgee', width: 1.5, x: 3, y: 0.6 },
      { height: 0.23, image: 'mit', width: 0.4, x: 6.7, y: 2.54 },
    ],
    lines: [
      { endX: 5.5, startX: 2.75, thickness: 0.65, y: 2.6 },
      { endX: 6.6, startX: 5.6, thickness: 0.65, y: 2.6 },
    ],
    text,
  };
}

export async function generateSailingCardPdf(props: SailingCardPdfOptions) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([
    points(CARD_WIDTH_INCHES),
    points(CARD_HEIGHT_INCHES),
  ]);
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serifFont = await pdf.embedFont(StandardFonts.TimesRoman);
  const serifBoldFont = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const burgeeImage = await pdf.embedPng(props.assets.burgee);
  const mitImage = await pdf.embedPng(props.assets.mit);
  const fonts = {
    bold: boldFont,
    italic: italicFont,
    regular: regularFont,
    serif: serifFont,
    serifBold: serifBoldFont,
  } satisfies SailingCardPdfEmbeddedFonts;
  const layout = sailingCardPdfLayout({
    data: props.data,
    labels: props.labels,
  });
  const images = {
    burgee: burgeeImage,
    mit: mitImage,
  } as const;

  for (const image of layout.images) {
    drawImage(page, images[image.image], image);
  }

  for (const line of layout.lines) {
    drawLine(page, line);
  }

  for (const text of layout.text) {
    drawText(page, text, fonts);
  }

  return pdf.save();
}
