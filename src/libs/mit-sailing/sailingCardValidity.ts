import { instantForNyWallClock, nyYmd } from '@/lib/mit-sailing/nyTime';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

type SailingCardAgreementAcceptanceFields = {
  readonly acceptedAt: Date;
  readonly agreementHash: string;
  readonly agreementVersion: string;
};

type SailingCardFields = {
  readonly legalAgreementAcceptances: readonly SailingCardAgreementAcceptanceFields[];
  readonly sailingCardNumber: number | null;
  readonly sailingCardYear: number | null;
  readonly sailingCardExpiresOn: Date | null;
  readonly sailingCardIssuedAt: Date | null;
  readonly sailingCardRequestedAt?: Date | null;
  readonly sailingCardSwimAgreementInitials: string | null;
};

type SailingCardOnboardingProfileFields = {
  readonly emergencyContactName: string | null;
  readonly emergencyContactPhone: string | null;
  readonly phone: string | null;
};

type YearlySailingCardOnboardingFields = SailingCardFields &
  SailingCardOnboardingProfileFields;

type CurrentYearSailingCardRequestFields = {
  readonly cardYear: number;
  readonly legalAgreementAcceptance: {
    readonly agreementHash: string;
    readonly agreementVersion: string;
    readonly source: string;
    readonly userId: string;
  } | null;
  readonly status: string;
  readonly userId?: string;
  readonly user: SailingCardOnboardingProfileFields;
};

type SailingCardStatus = 'current' | 'pending_review' | 'needs_onboarding';

const hasCurrentSailingCardAgreementAcceptance = (card: {
  readonly legalAgreementAcceptances: readonly SailingCardAgreementAcceptanceFields[];
}) =>
  card.legalAgreementAcceptances.some(
    (acceptance) =>
      acceptance.agreementHash === sailingCardAgreementHash() &&
      acceptance.agreementVersion === sailingCardAgreement.version
  );

export const getCurrentSailingCardYear = (now = new Date()) => {
  const currentNyDate = nyYmd(now);
  const currentYear = Number(currentNyDate.slice(0, 4));
  const rolloverDate = `${currentYear}-07-15`;

  return currentNyDate >= rolloverDate ? currentYear + 1 : currentYear;
};

export const getSailingCardExpirationDate = (cardYear: number) =>
  instantForNyWallClock(cardYear, 7, 15, 0, 0);

const dateOnlyKey = (date: Date) => date.toISOString().slice(0, 10);

export const hasCurrentSailingCard = (
  card: SailingCardFields,
  now = new Date()
) => {
  if (card.sailingCardNumber === null || card.sailingCardYear === null) {
    return false;
  }

  if (card.sailingCardIssuedAt === null || card.sailingCardExpiresOn === null) {
    return false;
  }

  if (!hasCurrentSailingCardAgreementAcceptance(card)) {
    return false;
  }

  return (
    card.sailingCardYear === getCurrentSailingCardYear(now) &&
    dateOnlyKey(card.sailingCardExpiresOn) > nyYmd(now)
  );
};

export const getSailingCardStatus = (
  card: SailingCardFields,
  now = new Date()
): SailingCardStatus => {
  if (hasCurrentSailingCard(card, now)) {
    return 'current';
  }

  if (
    card.sailingCardRequestedAt !== null &&
    card.sailingCardRequestedAt !== undefined
  ) {
    return 'pending_review';
  }

  return 'needs_onboarding';
};

export const hasRequiredSailingCardOnboardingProfile = (
  profile: SailingCardOnboardingProfileFields
) =>
  profile.phone !== null &&
  profile.phone.trim() !== '' &&
  profile.emergencyContactName !== null &&
  profile.emergencyContactName.trim() !== '' &&
  profile.emergencyContactPhone !== null &&
  profile.emergencyContactPhone.trim() !== '';

export const hasCompletedYearlySailingCardOnboarding = (
  user: YearlySailingCardOnboardingFields,
  now = new Date()
) =>
  hasRequiredSailingCardOnboardingProfile(user) &&
  hasCurrentSailingCardAgreementAcceptance(user) &&
  hasCurrentSailingCard(user, now);

export const hasCompletedCurrentYearSailingCardRequest = (
  request: CurrentYearSailingCardRequestFields | null,
  now = new Date()
) =>
  request !== null &&
  request.cardYear === getCurrentSailingCardYear(now) &&
  request.legalAgreementAcceptance !== null &&
  request.legalAgreementAcceptance.agreementHash ===
    sailingCardAgreementHash() &&
  request.legalAgreementAcceptance.agreementVersion ===
    sailingCardAgreement.version &&
  request.legalAgreementAcceptance.source === 'SAILING_CARD_ONBOARDING' &&
  (request.userId === undefined ||
    request.legalAgreementAcceptance.userId === request.userId) &&
  request.status !== 'cancelled' &&
  hasRequiredSailingCardOnboardingProfile(request.user);
