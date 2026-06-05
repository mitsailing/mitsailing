import { describe, expect, it } from 'vitest';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';
import {
  getCurrentSailingCardYear,
  getSailingCardExpirationDate,
  getSailingCardStatus,
  hasCompletedCurrentYearSailingCardRequest,
  hasCompletedYearlySailingCardOnboarding,
  hasCurrentSailingCard,
  hasRequiredSailingCardOnboardingProfile,
} from '@/libs/mit-sailing/sailingCardValidity';

describe('sailingCardValidity', () => {
  const currentAgreementAcceptance = {
    acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
    agreementHash: sailingCardAgreementHash(),
    agreementVersion: sailingCardAgreement.version,
  };
  const currentOnboardingAgreementAcceptance = {
    acceptedUserId: 'user-1',
    agreementHash: sailingCardAgreementHash(),
    agreementVersion: sailingCardAgreement.version,
    source: 'SAILING_CARD_ONBOARDING',
  };

  it('uses the current year before july 15 eastern', () => {
    expect(
      getCurrentSailingCardYear(new Date('2026-07-14T15:00:00-04:00'))
    ).toBe(2026);
  });

  it('uses the next year on july 15 eastern', () => {
    expect(
      getCurrentSailingCardYear(new Date('2026-07-15T00:01:00-04:00'))
    ).toBe(2027);
  });

  it('sets expiration to july 15 eastern for the card year', () => {
    expect(getSailingCardExpirationDate(2027).toISOString()).toBe(
      '2027-07-15T04:00:00.000Z'
    );
  });

  it('requires number year issued date expiration and current agreement acceptance for current card', () => {
    const now = new Date('2026-08-01T12:00:00-04:00');
    expect(
      hasCurrentSailingCard(
        {
          legalAgreementAcceptances: [currentAgreementAcceptance],
          sailingCardNumber: 61,
          sailingCardYear: 2027,
          sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: now,
          sailingCardSwimAgreementInitials: null,
        },
        now
      )
    ).toBe(true);
  });

  it('does not accept expired card', () => {
    expect(
      hasCurrentSailingCard(
        {
          legalAgreementAcceptances: [currentAgreementAcceptance],
          sailingCardNumber: 61,
          sailingCardYear: 2026,
          sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: new Date('2025-08-01T12:00:00-04:00'),
          sailingCardSwimAgreementInitials: null,
        },
        new Date('2026-07-15T00:01:00-04:00')
      )
    ).toBe(false);
  });

  it('does not accept missing current agreement acceptance', () => {
    const now = new Date('2026-08-01T12:00:00-04:00');
    expect(
      hasCurrentSailingCard(
        {
          legalAgreementAcceptances: [],
          sailingCardNumber: 61,
          sailingCardYear: 2027,
          sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: now,
          sailingCardSwimAgreementInitials: 'AK',
        },
        now
      )
    ).toBe(false);
  });

  it('does not accept stale agreement acceptance evidence', () => {
    const now = new Date('2026-08-01T12:00:00-04:00');
    expect(
      hasCurrentSailingCard(
        {
          legalAgreementAcceptances: [
            {
              acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
              agreementHash: '0'.repeat(64),
              agreementVersion: sailingCardAgreement.version,
            },
          ],
          sailingCardNumber: 61,
          sailingCardYear: 2027,
          sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: now,
          sailingCardSwimAgreementInitials: 'AK',
        },
        now
      )
    ).toBe(false);
  });

  it('treats postgres date-only expiration as current before july 15 eastern', () => {
    expect(
      hasCurrentSailingCard(
        {
          legalAgreementAcceptances: [currentAgreementAcceptance],
          sailingCardNumber: 61,
          sailingCardYear: 2027,
          sailingCardExpiresOn: new Date('2027-07-15T00:00:00.000Z'),
          sailingCardIssuedAt: new Date('2026-08-01T12:00:00-04:00'),
          sailingCardSwimAgreementInitials: null,
        },
        new Date('2027-07-14T21:00:00-04:00')
      )
    ).toBe(true);
  });

  it('derives pending review from requested date without issued card', () => {
    expect(
      getSailingCardStatus(
        {
          legalAgreementAcceptances: [currentAgreementAcceptance],
          sailingCardNumber: null,
          sailingCardYear: null,
          sailingCardExpiresOn: null,
          sailingCardIssuedAt: null,
          sailingCardRequestedAt: new Date('2026-05-01T12:00:00-04:00'),
          sailingCardSwimAgreementInitials: null,
        },
        new Date('2026-05-02T12:00:00-04:00')
      )
    ).toBe('pending_review');
  });

  it('does not complete yearly onboarding without current agreement evidence', () => {
    expect(
      hasCompletedYearlySailingCardOnboarding({
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        legalAgreementAcceptances: [],
        phone: '+16175550100',
        sailingCardNumber: null,
        sailingCardYear: null,
        sailingCardExpiresOn: null,
        sailingCardIssuedAt: null,
        sailingCardRequestedAt: new Date('2026-05-01T12:00:00-04:00'),
        sailingCardSwimAgreementInitials: 'GH',
      })
    ).toBe(false);
  });

  it('does not complete yearly onboarding from legacy pending user fields', () => {
    expect(
      hasCompletedYearlySailingCardOnboarding({
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        legalAgreementAcceptances: [currentAgreementAcceptance],
        phone: '+16175550100',
        sailingCardNumber: null,
        sailingCardYear: null,
        sailingCardExpiresOn: null,
        sailingCardIssuedAt: null,
        sailingCardRequestedAt: new Date('2026-05-01T12:00:00-04:00'),
        sailingCardSwimAgreementInitials: null,
      })
    ).toBe(false);
  });

  it('completes onboarding with a current-year request linked to legal evidence', () => {
    expect(
      hasCompletedCurrentYearSailingCardRequest(
        {
          cardYear: 2026,
          legalAgreementAcceptance: currentOnboardingAgreementAcceptance,
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
        new Date('2026-05-21T12:00:00-04:00')
      )
    ).toBe(true);
  });

  it('requires onboarding again for a prior-year pending request after cutoff', () => {
    expect(
      hasCompletedCurrentYearSailingCardRequest(
        {
          cardYear: 2026,
          legalAgreementAcceptance: currentOnboardingAgreementAcceptance,
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
        new Date('2026-07-15T00:01:00-04:00')
      )
    ).toBe(false);
  });

  it('does not complete onboarding when current-year request lacks linked evidence', () => {
    expect(
      hasCompletedCurrentYearSailingCardRequest(
        {
          cardYear: 2026,
          legalAgreementAcceptance: null,
          status: 'pending',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
        new Date('2026-05-21T12:00:00-04:00')
      )
    ).toBe(false);
  });

  it('does not complete onboarding with event-registration legal evidence', () => {
    expect(
      hasCompletedCurrentYearSailingCardRequest(
        {
          cardYear: 2026,
          legalAgreementAcceptance: {
            ...currentOnboardingAgreementAcceptance,
            source: 'EVENT_REGISTRATION',
          },
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
        new Date('2026-05-21T12:00:00-04:00')
      )
    ).toBe(false);
  });

  it('does not complete onboarding with another user legal evidence', () => {
    expect(
      hasCompletedCurrentYearSailingCardRequest(
        {
          cardYear: 2026,
          legalAgreementAcceptance: {
            ...currentOnboardingAgreementAcceptance,
            acceptedUserId: 'other-user',
          },
          status: 'pending',
          userId: 'user-1',
          user: {
            emergencyContactName: 'Grace Hopper',
            emergencyContactPhone: '+442079460958',
            phone: '+16175550100',
          },
        },
        new Date('2026-05-21T12:00:00-04:00')
      )
    ).toBe(false);
  });

  it('requires primary and emergency contact fields for completed onboarding', () => {
    expect(
      hasRequiredSailingCardOnboardingProfile({
        emergencyContactName: 'Grace Hopper',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      })
    ).toBe(true);
    expect(
      hasRequiredSailingCardOnboardingProfile({
        emergencyContactName: '',
        emergencyContactPhone: '+442079460958',
        phone: '+16175550100',
      })
    ).toBe(false);
  });

  it('does not complete yearly onboarding without emergency contact', () => {
    expect(
      hasCompletedYearlySailingCardOnboarding(
        {
          emergencyContactName: null,
          emergencyContactPhone: '+442079460958',
          legalAgreementAcceptances: [currentAgreementAcceptance],
          phone: '+16175550100',
          sailingCardNumber: 61,
          sailingCardYear: 2027,
          sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
          sailingCardIssuedAt: new Date('2026-08-01T12:00:00-04:00'),
          sailingCardSwimAgreementInitials: null,
        },
        new Date('2026-08-01T12:00:00-04:00')
      )
    ).toBe(false);
  });
});
