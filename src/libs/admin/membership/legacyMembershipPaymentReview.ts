import 'server-only';
import {
  PaymentPurpose,
  PaymentSource,
  PaymentStatus,
} from '@/generated/prisma/enums';
import type { SailingCardType } from '@/generated/prisma/enums';
import { prisma } from '@/libs/DB';

type LegacyMembershipReviewReason =
  | 'legacy_membership_review_required'
  | 'no_user_match'
  | 'unsettled_legacy_payment';

export type LegacyMembershipPaymentReviewRow = {
  readonly amountCents: number;
  readonly cardType: SailingCardType | null;
  readonly cardYear: number | null;
  readonly createdAt: Date;
  readonly id: string;
  readonly legacyCategory: string | null;
  readonly legacyDescription: string | null;
  readonly legacySettled: boolean | null;
  readonly legacySourceId: string | null;
  readonly legacySourceTable: string | null;
  readonly payerEmail: string | null;
  readonly payerName: string | null;
  readonly reviewReason: LegacyMembershipReviewReason;
  readonly user: {
    readonly email: string;
    readonly id: string;
    readonly name: string;
  } | null;
};

function legacyMembershipReviewReason(
  row: Pick<LegacyMembershipPaymentReviewRow, 'legacySettled' | 'user'>
): LegacyMembershipReviewReason {
  if (row.user === null) {
    return 'no_user_match';
  }
  if (row.legacySettled === false) {
    return 'unsettled_legacy_payment';
  }
  return 'legacy_membership_review_required';
}

export async function listLegacyMembershipPaymentReviewRows(): Promise<
  LegacyMembershipPaymentReviewRow[]
> {
  const rows = await prisma.payment.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      amountCents: true,
      cardType: true,
      cardYear: true,
      createdAt: true,
      id: true,
      legacyCategory: true,
      legacyDescription: true,
      legacySettled: true,
      legacySourceId: true,
      legacySourceTable: true,
      payerEmail: true,
      payerName: true,
      user: { select: { email: true, id: true, name: true } },
    },
    where: {
      purpose: PaymentPurpose.membership,
      source: PaymentSource.legacy,
      status: PaymentStatus.needs_review,
    },
  });

  return rows.map((row) => ({
    ...row,
    reviewReason: legacyMembershipReviewReason(row),
  }));
}
