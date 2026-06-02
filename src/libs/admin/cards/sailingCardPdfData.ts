import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import type {
  SailingCardPdfAssets,
  SailingCardPdfData,
} from '@/libs/admin/cards/sailingCardPdf';
import { prisma } from '@/libs/DB';
import { sailingCardAgreementHash } from '@/libs/mit-sailing/sailingCardAgreement';
import { hasCurrentSailingCard } from '@/libs/mit-sailing/sailingCardValidity';

const sailingAffiliationLabels = {
  [SailingAffiliation.MIT_STUDENT]: 'MIT Student',
  [SailingAffiliation.MIT_FACULTY]: 'MIT Faculty',
  [SailingAffiliation.MIT_STAFF]: 'MIT Staff',
  [SailingAffiliation.MIT_ALUM]: 'MIT Alum',
  [SailingAffiliation.MIT_FAMILY]: 'MIT Family',
  [SailingAffiliation.MIT_AFFILIATE]: 'MIT Affiliate',
  [SailingAffiliation.WELLESLEY]: 'Wellesley',
  [SailingAffiliation.BRANDEIS]: 'Brandeis',
  [SailingAffiliation.NORTHEASTERN]: 'Northeastern',
  [SailingAffiliation.WINSOR]: 'Winsor',
  [SailingAffiliation.BROOKS]: 'Brooks',
  [SailingAffiliation.NROTC]: 'NROTC',
  [SailingAffiliation.OTHER_STUDENT]: 'Other Student',
  [SailingAffiliation.OTHER_NON_STUDENT]: 'Other Non-Student',
  [SailingAffiliation.NON_MIT]: 'Non-MIT',
} as const satisfies Record<SailingAffiliation, string>;

const sailingCardTypeLabels = {
  [SailingCardType.normal]: 'Normal',
  [SailingCardType.racing]: 'Pavilion racing',
  [SailingCardType.team_racing]: 'Thursday team racing',
} as const satisfies Record<SailingCardType, string>;

let cachedSailingCardPdfAssets: Promise<SailingCardPdfAssets> | null = null;

function assetPath(filename: string) {
  return path.join(
    process.cwd(),
    'public',
    'assets',
    'images',
    'sailing-card',
    filename
  );
}

async function readSailingCardPdfAssets() {
  const [burgee, mit] = await Promise.all([
    readFile(assetPath('burgee_bw.png')),
    readFile(assetPath('mit_grey.png')),
  ]);

  return { burgee, mit };
}

export async function loadSailingCardPdfAssets() {
  cachedSailingCardPdfAssets ??= readSailingCardPdfAssets();
  const assets = await cachedSailingCardPdfAssets;

  return assets;
}

export async function getSailingCardPdfData(
  userId: string
): Promise<SailingCardPdfData | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      legalAgreementAcceptances: {
        where: { agreementHash: sailingCardAgreementHash() },
        select: {
          acceptedAt: true,
          agreementHash: true,
          agreementVersion: true,
        },
      },
      mitClassYear: true,
      phone: true,
      sailingAffiliation: true,
      sailingCardExpiresOn: true,
      sailingCardIssuedAt: true,
      sailingCardNumber: true,
      sailingCardRequests: {
        orderBy: { requestedAt: 'desc' },
        select: {
          cardType: true,
          cardYear: true,
          issuedCardNumber: true,
        },
        take: 5,
      },
      sailingCardSwimAgreementInitials: true,
      sailingCardYear: true,
    },
  });

  if (user === null || !hasCurrentSailingCard(user)) {
    return null;
  }

  const cardNumber = user.sailingCardNumber;
  const cardYear = user.sailingCardYear;
  const expiresOn = user.sailingCardExpiresOn;
  if (cardNumber === null || cardYear === null || expiresOn === null) {
    return null;
  }

  const cardRequest =
    user.sailingCardRequests.find(
      (request) =>
        request.cardYear === cardYear && request.issuedCardNumber === cardNumber
    ) ??
    user.sailingCardRequests.find((request) => request.cardYear === cardYear);
  const ratings = await prisma.userSailingRating.findMany({
    orderBy: { sailingRating: { displayOrder: 'asc' } },
    select: {
      sailingRating: {
        select: {
          level: true,
          name: true,
          shortName: true,
        },
      },
    },
    where: {
      sailingRating: { isDeprecated: false },
      userId,
    },
  });

  return {
    affiliationLabel:
      user.sailingAffiliation === null
        ? ''
        : sailingAffiliationLabels[user.sailingAffiliation],
    cardNumber,
    cardTypeLabel: sailingCardTypeLabels[cardRequest?.cardType ?? 'normal'],
    cardYear,
    classYear: user.mitClassYear,
    email: user.email,
    expiresOn,
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone,
    ratings: ratings.map((rating) => ({
      level: rating.sailingRating.level,
      name: rating.sailingRating.shortName ?? rating.sailingRating.name,
    })),
    userId: user.id,
  };
}
