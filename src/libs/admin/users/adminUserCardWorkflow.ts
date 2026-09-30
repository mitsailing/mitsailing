import type { AdminSailingCardPaymentAccess } from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import {
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import type { getAdminUserSailingCardSummary } from '@/libs/admin/cards/adminSailingCardUiQueries';
import type { AdminUserPaymentHistoryRow } from '@/libs/admin/users/adminUserPaymentHistory';
import { membershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';
import { needsFitnessMembershipQuestion } from '@/libs/mit-sailing/sailingCardMembership';
import {
  getCurrentSailingCardYear,
  hasCurrentSailingCard,
} from '@/libs/mit-sailing/sailingCardValidity';

export type AdminUserSailingCardSummary = NonNullable<
  Awaited<ReturnType<typeof getAdminUserSailingCardSummary>>
>;

export type AdminUserSailingCardRequestSummary =
  AdminUserSailingCardSummary['sailingCardRequests'][number];

type AdminUserCardWorkflowState = 'current' | 'none' | 'pending';

export type AdminUserSailingCardStatusMessageKey =
  | 'sailing_card_status_approved'
  | 'sailing_card_status_cancelled'
  | 'sailing_card_status_current'
  | 'sailing_card_status_none'
  | 'sailing_card_status_requested';

export type AdminUserCardWorkflowModel = {
  readonly agreement:
    | AdminUserSailingCardSummary['legalAgreementAcceptances'][number]
    | undefined;
  readonly cardNumber: number | null;
  readonly cardTypeLabelKey: string | null;
  readonly cardYear: number | null;
  readonly hasCurrentCard: boolean;
  readonly issuePaymentAccess: AdminSailingCardPaymentAccess | undefined;
  readonly latestRequest: AdminUserSailingCardRequestSummary | undefined;
  readonly needsRecreationVerification: boolean;
  readonly pendingCardNumber: number;
  readonly pendingRequest: AdminUserSailingCardRequestSummary | null;
  readonly state: AdminUserCardWorkflowState;
  readonly statusMessageKey: AdminUserSailingCardStatusMessageKey;
  readonly summary: AdminUserSailingCardSummary;
};

const sailingCardRequestStatusMessageKeys = {
  [SailingCardRequestStatus.approved]: 'sailing_card_status_approved',
  [SailingCardRequestStatus.cancelled]: 'sailing_card_status_cancelled',
  [SailingCardRequestStatus.pending]: 'sailing_card_status_requested',
} as const satisfies Record<
  SailingCardRequestStatus,
  AdminUserSailingCardStatusMessageKey
>;

const sailingCardTypeMessageKeys = {
  [SailingCardType.normal]: 'sailing_card_type_normal',
  [SailingCardType.racing]: 'sailing_card_type_racing',
  [SailingCardType.team_racing]: 'sailing_card_type_team_racing',
} as const;

export function currentPendingSailingCardRequest(
  summary: AdminUserSailingCardSummary | null
) {
  const currentYear = getCurrentSailingCardYear();
  return (
    summary?.sailingCardRequests.find(
      (request) =>
        request.cardYear === currentYear &&
        request.status === SailingCardRequestStatus.pending
    ) ?? null
  );
}

export function sailingCardStatusMessageKey(props: {
  readonly hasCurrentCard: boolean;
  readonly request: AdminUserSailingCardRequestSummary | undefined;
}): AdminUserSailingCardStatusMessageKey {
  if (props.request?.status === SailingCardRequestStatus.pending) {
    return 'sailing_card_status_requested';
  }
  if (props.hasCurrentCard) {
    return 'sailing_card_status_current';
  }
  if (props.request) {
    return sailingCardRequestStatusMessageKeys[props.request.status];
  }
  return 'sailing_card_status_none';
}

function membershipPaymentAccessFromRow(props: {
  readonly cardYear: number;
  readonly row: AdminUserPaymentHistoryRow;
}) {
  const { cardType } = props.row;
  if (props.row.status === 'checkout_created') {
    return membershipPaymentAccessStatus({
      cardYear: props.cardYear,
      record: null,
    });
  }
  if (
    cardType !== SailingCardType.racing &&
    cardType !== SailingCardType.team_racing
  ) {
    return membershipPaymentAccessStatus({
      cardYear: props.cardYear,
      record: null,
    });
  }

  return membershipPaymentAccessStatus({
    cardYear: props.cardYear,
    record: {
      cardType,
      cardYear: props.cardYear,
      source: props.row.source,
      status: props.row.status,
      stripeReceiptUrl: props.row.receiptHref,
    },
  });
}

export function latestMembershipPaymentAccess(props: {
  readonly cardType?: SailingCardType;
  readonly cardYear: number;
  readonly rows: readonly AdminUserPaymentHistoryRow[];
}) {
  const currentAccess = membershipPaymentAccessStatus({
    cardYear: props.cardYear,
    record: null,
  });
  const matchingRows = props.rows
    .filter(
      (row) =>
        row.purpose === 'membership' &&
        row.cardYear === props.cardYear &&
        (props.cardType
          ? row.cardType === props.cardType
          : row.cardType === SailingCardType.racing ||
            row.cardType === SailingCardType.team_racing)
    )
    .toSorted(
      (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
    );

  for (const row of matchingRows) {
    if (row.status === 'checkout_created') {
      continue;
    }
    return membershipPaymentAccessFromRow({ cardYear: props.cardYear, row });
  }

  return currentAccess;
}

export function sailingCardIssuePaymentAccess(props: {
  readonly request: AdminUserSailingCardRequestSummary | null;
  readonly rows: readonly AdminUserPaymentHistoryRow[];
}): AdminSailingCardPaymentAccess | undefined {
  const { request } = props;
  if (!request) {
    return undefined;
  }
  if (
    request.cardType !== SailingCardType.racing &&
    request.cardType !== SailingCardType.team_racing
  ) {
    return 'none';
  }

  return latestMembershipPaymentAccess({
    cardType: request.cardType,
    cardYear: request.cardYear,
    rows: props.rows,
  }).access;
}

export function pendingRequestNeedsRecreationVerification(props: {
  readonly request: AdminUserSailingCardRequestSummary | null;
  readonly summary: AdminUserSailingCardSummary | null;
}) {
  if (!props.request || !props.summary) {
    return false;
  }

  return (
    props.request.cardType === SailingCardType.normal &&
    props.summary.gymMembershipVerifiedAt === null &&
    needsFitnessMembershipQuestion(props.request.sailingAffiliation)
  );
}

function adminUserCardWorkflowState(props: {
  readonly hasCurrentCard: boolean;
  readonly pendingRequest: AdminUserSailingCardRequestSummary | null;
}): AdminUserCardWorkflowState {
  if (props.pendingRequest) {
    return 'pending';
  }
  if (props.hasCurrentCard) {
    return 'current';
  }
  return 'none';
}

export function adminUserCardWorkflowModel(props: {
  readonly paymentRows: readonly AdminUserPaymentHistoryRow[];
  readonly suggestedCardNumber: number;
  readonly summary: AdminUserSailingCardSummary | null;
}): AdminUserCardWorkflowModel | null {
  if (!props.summary) {
    return null;
  }

  const hasCurrentCard = hasCurrentSailingCard(props.summary);
  const pendingRequest = currentPendingSailingCardRequest(props.summary);
  const latestRequest =
    pendingRequest ?? props.summary.sailingCardRequests.at(0);

  return {
    agreement: props.summary.legalAgreementAcceptances[0],
    cardNumber: props.summary.sailingCardNumber,
    cardTypeLabelKey: latestRequest
      ? sailingCardTypeMessageKeys[latestRequest.cardType]
      : null,
    cardYear:
      pendingRequest?.cardYear ??
      latestRequest?.cardYear ??
      props.summary.sailingCardYear,
    hasCurrentCard,
    issuePaymentAccess: sailingCardIssuePaymentAccess({
      request: pendingRequest,
      rows: props.paymentRows,
    }),
    latestRequest,
    needsRecreationVerification: pendingRequestNeedsRecreationVerification({
      request: pendingRequest,
      summary: props.summary,
    }),
    pendingCardNumber:
      pendingRequest?.issuedCardNumber ?? props.suggestedCardNumber,
    pendingRequest,
    state: adminUserCardWorkflowState({ hasCurrentCard, pendingRequest }),
    statusMessageKey: sailingCardStatusMessageKey({
      hasCurrentCard,
      request: latestRequest,
    }),
    summary: props.summary,
  };
}
