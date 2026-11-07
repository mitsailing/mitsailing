import { describe, expect, it } from 'vitest';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import {
  hasAutomaticFitnessMembership,
  needsFitnessMembershipQuestion,
  sailingCardMembershipPriceCents,
} from '@/libs/mit-sailing/sailingCardMembership';

describe('sailingCardMembership', () => {
  const studentPaidRacingAffiliations: readonly SailingAffiliation[] = [
    SailingAffiliation.WELLESLEY,
    SailingAffiliation.BRANDEIS,
    SailingAffiliation.NORTHEASTERN,
    SailingAffiliation.WINSOR,
    SailingAffiliation.BROOKS,
    SailingAffiliation.NROTC,
    SailingAffiliation.OTHER_STUDENT,
  ];
  const agePricedRacingAffiliations: readonly SailingAffiliation[] = [
    SailingAffiliation.MIT_FACULTY,
    SailingAffiliation.MIT_STAFF,
    SailingAffiliation.MIT_ALUM,
    SailingAffiliation.MIT_FAMILY,
    SailingAffiliation.MIT_AFFILIATE,
    SailingAffiliation.OTHER_NON_STUDENT,
    SailingAffiliation.NON_MIT,
  ];
  const beforeJuly15 = new Date('2026-05-27T12:00:00.000Z');
  const afterJuly15 = new Date('2026-07-15T12:00:00.000Z');

  it('treats mit students as automatic fitness members', () => {
    expect(hasAutomaticFitnessMembership(SailingAffiliation.MIT_STUDENT)).toBe(
      true
    );
    expect(needsFitnessMembershipQuestion(SailingAffiliation.MIT_STUDENT)).toBe(
      false
    );
    expect(needsFitnessMembershipQuestion(SailingAffiliation.MIT_ALUM)).toBe(
      true
    );
  });

  it('does not charge MIT students for sailing card membership', () => {
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.racing,
        dateOfBirth: '01/02/2000',
        now: beforeJuly15,
      })
    ).toBe(0);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/2000',
        now: beforeJuly15,
      })
    ).toBe(0);
  });

  it.each([beforeJuly15, afterJuly15])(
    'prices racing memberships by student status and age on %s',
    (now) => {
      expect(
        sailingCardMembershipPriceCents({
          affiliation: SailingAffiliation.WELLESLEY,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now,
        })
      ).toBe(4000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation: SailingAffiliation.MIT_ALUM,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now,
        })
      ).toBe(12_500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation: SailingAffiliation.MIT_ALUM,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now,
        })
      ).toBe(17_500);
    }
  );

  it('prices team racing by student status and age', () => {
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.NORTHEASTERN,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/2000',
        now: afterJuly15,
      })
    ).toBe(2500);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/2000',
        now: afterJuly15,
      })
    ).toBe(7000);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/1990',
        now: afterJuly15,
      })
    ).toBe(10_000);
  });

  it('returns null when non-student racing price needs a date of birth', () => {
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        dateOfBirth: undefined,
        now: beforeJuly15,
      })
    ).toBeNull();
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        dateOfBirth: '',
        now: beforeJuly15,
      })
    ).toBeNull();
  });

  it.each(studentPaidRacingAffiliations)(
    'keeps %s on student paid racing pricing year-round',
    (affiliation) => {
      for (const now of [beforeJuly15, afterJuly15]) {
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.racing,
            dateOfBirth: '01/02/2000',
            now,
          })
        ).toBe(4000);
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.racing,
            dateOfBirth: '01/02/1990',
            now,
          })
        ).toBe(4000);
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.team_racing,
            dateOfBirth: '01/02/2000',
            now,
          })
        ).toBe(2500);
      }
    }
  );

  it.each(agePricedRacingAffiliations)(
    'keeps %s on age-based paid racing pricing year-round',
    (affiliation) => {
      for (const now of [beforeJuly15, afterJuly15]) {
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.racing,
            dateOfBirth: '01/02/2000',
            now,
          })
        ).toBe(12_500);
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.racing,
            dateOfBirth: '01/02/1990',
            now,
          })
        ).toBe(17_500);
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.team_racing,
            dateOfBirth: '01/02/2000',
            now,
          })
        ).toBe(7000);
        expect(
          sailingCardMembershipPriceCents({
            affiliation,
            cardType: SailingCardType.team_racing,
            dateOfBirth: '01/02/1990',
            now,
          })
        ).toBe(10_000);
      }
    }
  );
});
