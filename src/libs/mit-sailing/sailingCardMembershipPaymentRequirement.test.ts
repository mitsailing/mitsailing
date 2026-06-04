import { describe, expect, it } from 'vitest';
import { SailingAffiliation, SailingCardType } from '@/generated/prisma/enums';
import { sailingCardRequestNeedsMembershipPayment } from '@/libs/mit-sailing/sailingCardMembershipPaymentRequirement';

describe('sailingCardMembershipPaymentRequirement', () => {
  const baseRequest = {
    cardType: SailingCardType.racing,
    hasFitnessMembership: false,
    sailingAffiliation: SailingAffiliation.MIT_ALUM,
    user: { gymMembershipVerifiedAt: null },
  };

  it('requires payment only when paid racing is available', () => {
    expect(sailingCardRequestNeedsMembershipPayment(baseRequest)).toBe(true);
    expect(
      sailingCardRequestNeedsMembershipPayment({
        ...baseRequest,
        cardType: SailingCardType.normal,
      })
    ).toBe(false);
    expect(
      sailingCardRequestNeedsMembershipPayment({
        ...baseRequest,
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
      })
    ).toBe(false);
    expect(
      sailingCardRequestNeedsMembershipPayment({
        ...baseRequest,
        hasFitnessMembership: true,
      })
    ).toBe(false);
    expect(
      sailingCardRequestNeedsMembershipPayment({
        ...baseRequest,
        user: { gymMembershipVerifiedAt: new Date('2026-05-01T12:00:00Z') },
      })
    ).toBe(false);
  });
});
