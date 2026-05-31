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
  const agePricedRacingAffiliations = Object.values(SailingAffiliation).filter(
    (affiliation) =>
      affiliation !== SailingAffiliation.MIT_STUDENT &&
      !studentPaidRacingAffiliations.includes(affiliation)
  );

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
        now: new Date('2026-05-01T12:00:00.000Z'),
      })
    ).toBe(0);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_STUDENT,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/2000',
        now: new Date('2026-05-01T12:00:00.000Z'),
      })
    ).toBe(0);
  });

  it('prices spring racing memberships by student status and age', () => {
    const now = new Date('2026-05-27T12:00:00.000Z');

    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.WELLESLEY,
        cardType: SailingCardType.racing,
        dateOfBirth: '01/02/2000',
        now,
      })
    ).toBe(2500);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        dateOfBirth: '01/02/2000',
        now,
      })
    ).toBe(7000);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        dateOfBirth: '01/02/1990',
        now,
      })
    ).toBe(10_000);
  });

  it('prices full-season racing memberships after july fifteenth', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');

    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.OTHER_STUDENT,
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
  });

  it('prices team racing by student status and age', () => {
    const now = new Date('2026-09-01T12:00:00.000Z');

    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.NORTHEASTERN,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/2000',
        now,
      })
    ).toBe(2500);
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.team_racing,
        dateOfBirth: '01/02/1990',
        now,
      })
    ).toBe(10_000);
  });

  it('returns no price when non-student age is unknown', () => {
    expect(
      sailingCardMembershipPriceCents({
        affiliation: SailingAffiliation.MIT_ALUM,
        cardType: SailingCardType.racing,
        dateOfBirth: '',
        now: new Date('2026-05-27T12:00:00.000Z'),
      })
    ).toBeNull();
  });

  it.each(studentPaidRacingAffiliations)(
    'keeps %s on legacy student paid racing pricing',
    (affiliation) => {
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(2500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(2500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(4000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(4000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(2500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(2500);
    }
  );

  it.each(agePricedRacingAffiliations)(
    'keeps %s on age-based paid racing pricing',
    (affiliation) => {
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(7000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(10_000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(12_500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(17_500);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(7000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-05-01T12:00:00.000Z'),
        })
      ).toBe(10_000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/2000',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(7000);
      expect(
        sailingCardMembershipPriceCents({
          affiliation,
          cardType: SailingCardType.team_racing,
          dateOfBirth: '01/02/1990',
          now: new Date('2026-07-15T12:00:00.000Z'),
        })
      ).toBe(10_000);
    }
  );
});
