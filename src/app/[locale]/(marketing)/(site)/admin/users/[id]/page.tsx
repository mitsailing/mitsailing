import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type * as React from 'react';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import { AdminPrimaryActionLink } from '@/components/mit-sailing/admin/AdminPrimaryActionLink';
import {
  AdminSailingCardChangeNumberForm,
  AdminSailingCardExpireForm,
  AdminSailingCardHistory,
  AdminSailingCardIssueForm,
  AdminSailingCardPrintActions,
} from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import type { AdminSailingCardPaymentAccess } from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import { AdminUserRatingsPanel } from '@/components/mit-sailing/admin/users/AdminUserRatingsPanel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PaymentSource,
  PaymentStatus,
  SailingAffiliation,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import { getNextAvailableSailingCardNumber } from '@/libs/admin/cards/adminSailingCardQueries';
import {
  getAdminSailingCardHistory,
  getAdminUserSailingCardSummary,
} from '@/libs/admin/cards/adminSailingCardUiQueries';
import { adminUserMembershipBlockers } from '@/libs/admin/users/adminUserMembershipStatus';
import type { AdminUserMembershipBlocker } from '@/libs/admin/users/adminUserMembershipStatus';
import { adminUsersEditPath } from '@/libs/admin/users/adminUserPaths';
import { listAdminUserPaymentHistory } from '@/libs/admin/users/adminUserPaymentHistory';
import type { AdminUserPaymentHistoryRow } from '@/libs/admin/users/adminUserPaymentHistory';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { appRoleFromSessionUser, requirePermission } from '@/libs/auth/dal';
import { getAdminUserEmailMessages } from '@/libs/email/emailMessages';
import type { AdminUserEmailMessageRow } from '@/libs/email/emailMessages';
import { logger } from '@/libs/Logger';
import { membershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';
import {
  getCurrentSailingCardYear,
  hasCurrentSailingCard,
} from '@/libs/mit-sailing/sailingCardValidity';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';
import { formatUsdMinorUnitsAsCurrency } from '@/libs/money/stripeUsdMinorUnits';

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type AdminUserShowPageProps = Readonly<{
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}>;

function emailDeliverabilityStatus(value: unknown): EmailDeliverabilityStatus {
  return value === 'bounced' || value === 'suppressed' ? value : 'ok';
}

function userSailingAffiliationLabelKey(affiliation: SailingAffiliation) {
  const keys = {
    MIT_STUDENT: 'affiliation_mit_student',
    MIT_FACULTY: 'affiliation_mit_faculty',
    MIT_STAFF: 'affiliation_mit_staff',
    MIT_ALUM: 'affiliation_mit_alum',
    MIT_FAMILY: 'affiliation_mit_family',
    MIT_AFFILIATE: 'affiliation_mit_affiliate',
    WELLESLEY: 'affiliation_wellesley',
    BRANDEIS: 'affiliation_brandeis',
    NORTHEASTERN: 'affiliation_northeastern',
    WINSOR: 'affiliation_winsor',
    BROOKS: 'affiliation_brooks',
    NROTC: 'affiliation_nrotc',
    OTHER_STUDENT: 'affiliation_other_student',
    OTHER_NON_STUDENT: 'affiliation_other_non_student',
    NON_MIT: 'affiliation_non_mit',
  } as const satisfies Record<SailingAffiliation, string>;

  return keys[affiliation];
}

function isSailingAffiliation(value: unknown): value is SailingAffiliation {
  return (
    typeof value === 'string' &&
    Object.values(SailingAffiliation).some(
      (affiliation) => affiliation === value
    )
  );
}

type EmailEventMessageKey =
  | 'email_event_bounced'
  | 'email_event_complained'
  | 'email_event_delivered'
  | 'email_event_delivery_delayed'
  | 'email_event_failed'
  | 'email_event_sent'
  | 'email_event_suppressed'
  | 'email_event_unknown';

const emailEventMessageKeys: ReadonlyMap<string, EmailEventMessageKey> =
  new Map([
    ['email.bounced', 'email_event_bounced'],
    ['email.complained', 'email_event_complained'],
    ['email.delivered', 'email_event_delivered'],
    ['email.delivery_delayed', 'email_event_delivery_delayed'],
    ['email.failed', 'email_event_failed'],
    ['email.sent', 'email_event_sent'],
    ['email.suppressed', 'email_event_suppressed'],
  ]);

function emailEventMessageKey(eventType: string | null): EmailEventMessageKey {
  return emailEventMessageKeys.get(eventType ?? '') ?? 'email_event_unknown';
}

type EmailCategoryMessageKey =
  | 'email_category_account_locked'
  | 'email_category_contact'
  | 'email_category_delete_account'
  | 'email_category_email_change'
  | 'email_category_newsletter'
  | 'email_category_newsletter_test'
  | 'email_category_other'
  | 'email_category_password_changed'
  | 'email_category_password_reset'
  | 'email_category_sign_in_otp'
  | 'email_category_verify_email';

const emailCategoryMessageKeys: ReadonlyMap<string, EmailCategoryMessageKey> =
  new Map([
    ['account_locked', 'email_category_account_locked'],
    ['contact', 'email_category_contact'],
    ['delete_account', 'email_category_delete_account'],
    ['email_change', 'email_category_email_change'],
    ['newsletter', 'email_category_newsletter'],
    ['newsletter_test', 'email_category_newsletter_test'],
    ['password_changed', 'email_category_password_changed'],
    ['password_reset', 'email_category_password_reset'],
    ['sign_in_otp', 'email_category_sign_in_otp'],
    ['verify_email', 'email_category_verify_email'],
  ]);

function emailCategoryMessageKey(category: string): EmailCategoryMessageKey {
  return emailCategoryMessageKeys.get(category) ?? 'email_category_other';
}

type AdminUserEmailsPanelProps = Readonly<{
  emails: AdminUserEmailMessageRow[];
  loadFailed: boolean;
  locale: string;
  t: Awaited<ReturnType<typeof getTranslations>>;
}>;

type AdminUserSailingCardSummary = Awaited<
  ReturnType<typeof getAdminUserSailingCardSummary>
>;

type AdminUserSailingCardDetails = {
  readonly history: Awaited<ReturnType<typeof getAdminSailingCardHistory>>;
  readonly loadError: boolean;
  readonly summary: AdminUserSailingCardSummary;
};

type AdminUserSailingCardRequestSummary =
  NonNullable<AdminUserSailingCardSummary>['sailingCardRequests'][number];

type AdminUserRatingDetails = {
  readonly loadError: boolean;
  readonly rows: UserRatingAssignmentRow[];
};

type AdminUserEmailDetails = {
  readonly loadError: boolean;
  readonly messages: AdminUserEmailMessageRow[];
};

type AdminUserPaymentDetails = {
  readonly loadError: boolean;
  readonly rows: AdminUserPaymentHistoryRow[];
};

async function loadAdminUserSailingCardDetails(
  userId: string
): Promise<AdminUserSailingCardDetails> {
  try {
    const [summary, history] = await Promise.all([
      getAdminUserSailingCardSummary(userId),
      getAdminSailingCardHistory(userId),
    ]);
    return { history, loadError: false, summary };
  } catch (error) {
    logger.error('Failed to load admin user sailing-card rows: {error}', {
      error,
      userId,
    });
    return { history: [], loadError: true, summary: null };
  }
}

async function loadAdminUserRatingDetails(
  userId: string
): Promise<AdminUserRatingDetails> {
  try {
    return {
      loadError: false,
      rows: await listUserRatingAssignmentRows(userId),
    };
  } catch (error) {
    logger.error('Failed to load admin user rating rows: {error}', {
      error,
      userId,
    });
    return { loadError: true, rows: [] };
  }
}

async function loadAdminUserEmailDetails(props: {
  readonly email: string;
  readonly userId: string;
}): Promise<AdminUserEmailDetails> {
  try {
    return {
      loadError: false,
      messages: await getAdminUserEmailMessages(props),
    };
  } catch (error) {
    logger.error('Failed to load admin user email message rows: {error}', {
      error,
      userId: props.userId,
    });
    return { loadError: true, messages: [] };
  }
}

async function loadAdminUserPaymentDetails(
  userId: string
): Promise<AdminUserPaymentDetails> {
  try {
    return {
      loadError: false,
      rows: await listAdminUserPaymentHistory(userId),
    };
  } catch (error) {
    logger.error('Failed to load admin user payment rows: {error}', {
      error,
      userId,
    });
    return { loadError: true, rows: [] };
  }
}

function AdminUserDetailValue(props: {
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div>
      <dt className="font-semibold">{props.label}</dt>
      <dd className="m-0">{props.value}</dd>
    </div>
  );
}

function optionalAdminDate(
  date: Date | null | undefined,
  locale: string,
  emptyValue: string
) {
  return date ? formatAdminDate(date, locale) : emptyValue;
}

function AdminUserPaymentBypassAlert(props: {
  readonly emptyValue: string;
  readonly locale: string;
  readonly request: AdminUserSailingCardRequestSummary | undefined;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (!props.request?.paymentBypassAt) {
    return null;
  }
  return (
    <output className="mt-3 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
      <span className="font-semibold">
        {props.t('sailing_card_payment_bypass_title')}
      </span>
      <span className="mt-1 block">
        {props.t('sailing_card_payment_bypass_body', {
          admin: props.request.paymentBypassBy?.name ?? props.emptyValue,
          date: formatAdminDate(props.request.paymentBypassAt, props.locale),
          note: props.request.paymentBypassNote ?? props.emptyValue,
        })}
      </span>
    </output>
  );
}

const sailingCardRequestStatusMessageKeys = {
  [SailingCardRequestStatus.approved]: 'sailing_card_status_approved',
  [SailingCardRequestStatus.cancelled]: 'sailing_card_status_cancelled',
  [SailingCardRequestStatus.pending]: 'sailing_card_status_requested',
} as const satisfies Record<SailingCardRequestStatus, string>;

const sailingCardTypeMessageKeys = {
  [SailingCardType.normal]: 'sailing_card_type_normal',
  [SailingCardType.racing]: 'sailing_card_type_racing',
  [SailingCardType.team_racing]: 'sailing_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

function currentPendingSailingCardRequest(
  summary: AdminUserSailingCardSummary
) {
  const currentYear = getCurrentSailingCardYear();
  return summary?.sailingCardRequests.find(
    (request) =>
      request.cardYear === currentYear &&
      request.status === SailingCardRequestStatus.pending
  );
}

function sailingCardStatusMessageKey(props: {
  readonly hasCurrentCard: boolean;
  readonly request: AdminUserSailingCardRequestSummary | undefined;
}) {
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

function sailingCardAssignmentMessageKey(props: {
  readonly hasCurrentCard: boolean;
  readonly request: AdminUserSailingCardRequestSummary | undefined;
}) {
  if (props.request?.status === SailingCardRequestStatus.pending) {
    return 'sailing_card_assignment_pending';
  }
  if (props.hasCurrentCard) {
    return 'sailing_card_assignment_issued';
  }
  if (props.request?.status === SailingCardRequestStatus.cancelled) {
    return 'sailing_card_assignment_cancelled';
  }
  return 'sailing_card_assignment_none';
}

function membershipPaymentAccessFromRow(props: {
  readonly cardYear: number;
  readonly row: AdminUserPaymentHistoryRow;
}) {
  const { cardType } = props.row;
  if (props.row.status === PaymentStatus.checkout_created) {
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

function latestMembershipPaymentAccess(props: {
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
    if (row.status === PaymentStatus.checkout_created) {
      continue;
    }
    return membershipPaymentAccessFromRow({ cardYear: props.cardYear, row });
  }

  return currentAccess;
}

function sailingCardIssuePaymentAccess(props: {
  readonly request: AdminUserSailingCardRequestSummary | undefined;
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

type AdminUserSailingCardSectionModel = {
  readonly agreement:
    | NonNullable<AdminUserSailingCardSummary>['legalAgreementAcceptances'][number]
    | undefined;
  readonly currentCardNumber: number | null;
  readonly displayedCardNumber: React.ReactNode;
  readonly emptyValue: string;
  readonly hasCurrentCard: boolean;
  readonly issuePaymentAccess: AdminSailingCardPaymentAccess | undefined;
  readonly latestRequest: AdminUserSailingCardRequestSummary | undefined;
  readonly paymentBypass: AdminUserSailingCardRequestSummary | undefined;
  readonly pendingCardNumber: number;
  readonly pendingRequest: AdminUserSailingCardRequestSummary | undefined;
};

function adminUserSailingCardSectionModel(props: {
  readonly paymentRows: readonly AdminUserPaymentHistoryRow[];
  readonly suggestedCardNumber: number;
  readonly summary: AdminUserSailingCardSummary;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}): AdminUserSailingCardSectionModel {
  const hasCurrentCard =
    props.summary !== null && hasCurrentSailingCard(props.summary);
  const pendingRequest = currentPendingSailingCardRequest(props.summary);
  const emptyValue = props.t('empty_value');

  return {
    agreement: props.summary?.legalAgreementAcceptances[0],
    currentCardNumber: props.summary?.sailingCardNumber ?? null,
    displayedCardNumber:
      props.summary?.sailingCardNumber ??
      pendingRequest?.issuedCardNumber ??
      emptyValue,
    emptyValue,
    hasCurrentCard,
    issuePaymentAccess: sailingCardIssuePaymentAccess({
      request: pendingRequest,
      rows: props.paymentRows,
    }),
    latestRequest: pendingRequest ?? props.summary?.sailingCardRequests[0],
    paymentBypass: props.summary?.paymentBypassRequest ?? undefined,
    pendingCardNumber:
      pendingRequest?.issuedCardNumber ?? props.suggestedCardNumber,
    pendingRequest,
  };
}

function AdminUserSailingCardNumberAction(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly userId: string;
}) {
  if (!props.canAssignCards) {
    return null;
  }
  const { currentCardNumber } = props.model;

  if (props.model.pendingRequest) {
    return (
      <div className="mt-4">
        <AdminSailingCardIssueForm
          cardType={props.model.pendingRequest.cardType}
          locale={props.locale}
          paymentAccess={props.model.issuePaymentAccess}
          suggestedCardNumber={props.model.pendingCardNumber}
          userId={props.userId}
        />
      </div>
    );
  }

  if (props.model.hasCurrentCard && typeof currentCardNumber === 'number') {
    return (
      <div className="mt-4">
        <AdminSailingCardChangeNumberForm
          currentCardNumber={currentCardNumber}
          locale={props.locale}
          userId={props.userId}
        />
      </div>
    );
  }

  return null;
}

function AdminUserSailingCardStatusPanel(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
  readonly userId: string;
}) {
  const cardNumberLabel = props.model.pendingRequest
    ? props.t('sailing_card_suggested_number')
    : props.t('sailing_card_number');
  const cardNumberHelp = props.model.pendingRequest
    ? props.t('sailing_card_suggested_number_help')
    : props.t('sailing_card_number_help');
  const statusHelp = props.model.pendingRequest
    ? props.t('sailing_card_status_requested_help')
    : props.t('sailing_card_status_default_help');

  return (
    <div className="mt-4 grid gap-4 border-y border-border py-4 md:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]">
      <div>
        <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {props.t('sailing_card_status')}
        </p>
        <p className="mt-1 text-2xl font-semibold text-foreground">
          {props.t(
            sailingCardStatusMessageKey({
              hasCurrentCard: props.model.hasCurrentCard,
              request: props.model.latestRequest,
            })
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{statusHelp}</p>
      </div>
      <div className="border-t border-border pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-4">
        <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {cardNumberLabel}
        </p>
        <p className="mt-1 text-3xl font-semibold text-foreground">
          {props.model.pendingRequest
            ? props.model.pendingCardNumber
            : props.model.displayedCardNumber}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{cardNumberHelp}</p>
        <AdminUserSailingCardNumberAction
          canAssignCards={props.canAssignCards}
          locale={props.locale}
          model={props.model}
          userId={props.userId}
        />
      </div>
    </div>
  );
}

function sailingCardTypeValue(props: {
  readonly emptyValue: string;
  readonly request: AdminUserSailingCardRequestSummary | undefined;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return props.request
    ? props.t(sailingCardTypeMessageKeys[props.request.cardType])
    : props.emptyValue;
}

function sailingCardSwimAgreementValue(props: {
  readonly locale: string;
  readonly summary: AdminUserSailingCardSummary;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (
    props.summary?.sailingCardSwimAgreementInitialedAt &&
    props.summary.sailingCardSwimAgreementInitials
  ) {
    return props.t('sailing_card_swim_agreement_value', {
      date: formatAdminDate(
        props.summary.sailingCardSwimAgreementInitialedAt,
        props.locale
      ),
      initials: props.summary.sailingCardSwimAgreementInitials,
    });
  }
  return props.t('empty_value');
}

function AdminUserSailingCardDetailsList(props: {
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly summary: AdminUserSailingCardSummary;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <dl className="mt-4 grid gap-3 sm:grid-cols-3">
      <AdminUserDetailValue
        label={props.t('sailing_card_assignment')}
        value={props.t(
          sailingCardAssignmentMessageKey({
            hasCurrentCard: props.model.hasCurrentCard,
            request: props.model.latestRequest,
          })
        )}
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_type')}
        value={sailingCardTypeValue({
          emptyValue: props.model.emptyValue,
          request: props.model.latestRequest,
          t: props.t,
        })}
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_year')}
        value={
          props.summary?.sailingCardYear ??
          props.model.pendingRequest?.cardYear ??
          props.model.latestRequest?.cardYear ??
          props.model.emptyValue
        }
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_expires')}
        value={optionalAdminDate(
          props.summary?.sailingCardExpiresOn,
          props.locale,
          props.model.emptyValue
        )}
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_requested')}
        value={optionalAdminDate(
          props.model.pendingRequest?.requestedAt ??
            props.model.latestRequest?.requestedAt ??
            props.summary?.sailingCardRequestedAt,
          props.locale,
          props.model.emptyValue
        )}
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_agreement')}
        value={optionalAdminDate(
          props.model.agreement?.acceptedAt,
          props.locale,
          props.model.emptyValue
        )}
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_agreement_version')}
        value={
          props.model.agreement?.agreementVersion ?? props.model.emptyValue
        }
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_issued_by')}
        value={
          props.summary?.sailingCardIssuedBy?.name ?? props.model.emptyValue
        }
      />
      <AdminUserDetailValue
        label={props.t('sailing_card_swim_agreement')}
        value={sailingCardSwimAgreementValue({
          locale: props.locale,
          summary: props.summary,
          t: props.t,
        })}
      />
    </dl>
  );
}

function AdminUserSailingCardSection(props: {
  readonly canAssignCards: boolean;
  readonly canExpireCards: boolean;
  readonly canPrintCards: boolean;
  readonly history: AdminUserSailingCardDetails['history'];
  readonly loadError: boolean;
  readonly locale: string;
  readonly paymentRows: readonly AdminUserPaymentHistoryRow[];
  readonly suggestedCardNumber: number;
  readonly summary: AdminUserSailingCardSummary;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
  readonly userId: string;
}) {
  const model = adminUserSailingCardSectionModel({
    paymentRows: props.paymentRows,
    suggestedCardNumber: props.suggestedCardNumber,
    summary: props.summary,
    t: props.t,
  });

  return (
    <>
      <section className="rounded-lg border border-border bg-card p-5 text-sm text-foreground">
        <h2 className="m-0 text-lg font-semibold" id="sailing-card-status">
          {props.t('sailing_card_heading')}
        </h2>
        {props.loadError ? (
          <output className="mt-3 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {props.t('sailing_card_load_failed')}
          </output>
        ) : null}
        <AdminUserPaymentBypassAlert
          emptyValue={model.emptyValue}
          locale={props.locale}
          request={model.paymentBypass}
          t={props.t}
        />
        <AdminUserSailingCardStatusPanel
          canAssignCards={props.canAssignCards}
          locale={props.locale}
          model={model}
          t={props.t}
          userId={props.userId}
        />
        {props.canPrintCards && model.hasCurrentCard ? (
          <div className="mt-4">
            <AdminSailingCardPrintActions userId={props.userId} />
          </div>
        ) : null}
        <AdminUserSailingCardDetailsList
          locale={props.locale}
          model={model}
          summary={props.summary}
          t={props.t}
        />
        {props.canExpireCards && model.hasCurrentCard ? (
          <div className="mt-4">
            <AdminSailingCardExpireForm
              locale={props.locale}
              userId={props.userId}
            />
          </div>
        ) : null}
      </section>
      {props.loadError ? null : (
        <AdminSailingCardHistory rows={props.history} />
      )}
    </>
  );
}

function AdminUserEmailsPanel(props: AdminUserEmailsPanelProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{props.t('emails_heading')}</h2>
      {props.loadFailed ? (
        <output className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {props.t('emails_load_failed')}
        </output>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{props.t('email_column_subject')}</TableHead>
              <TableHead>{props.t('email_column_to')}</TableHead>
              <TableHead>{props.t('email_column_category')}</TableHead>
              <TableHead>{props.t('email_column_status')}</TableHead>
              <TableHead>{props.t('email_column_sent')}</TableHead>
              <TableHead>{props.t('email_column_error')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.emails.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>{props.t('emails_empty')}</TableCell>
              </TableRow>
            ) : (
              props.emails.map((email) => (
                <TableRow key={email.id}>
                  <TableCell className="font-medium">{email.subject}</TableCell>
                  <TableCell>{email.toEmail}</TableCell>
                  <TableCell>
                    {props.t(emailCategoryMessageKey(email.category))}
                  </TableCell>
                  <TableCell>
                    {props.t(emailEventMessageKey(email.lastEventType))}
                  </TableCell>
                  <TableCell>
                    {formatAdminDate(
                      email.sentAt ?? email.createdAt,
                      props.locale
                    )}
                  </TableCell>
                  <TableCell>
                    {email.lastError ?? props.t('empty_value')}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

const paymentStatusMessageKeys = {
  cancelled: 'payment_status_cancelled',
  checkout_created: 'payment_status_checkout_created',
  disputed: 'payment_status_disputed',
  handled: 'payment_status_handled',
  needs_review: 'payment_status_needs_review',
  paid: 'payment_status_paid',
  past_due: 'payment_status_past_due',
  pending: 'payment_status_pending',
  refunded: 'payment_status_refunded',
} as const satisfies Record<AdminUserPaymentHistoryRow['status'], string>;

const paymentPurposeMessageKeys = {
  event: 'payment_purpose_event',
  membership: 'payment_purpose_membership',
} as const satisfies Record<AdminUserPaymentHistoryRow['purpose'], string>;

const paymentSourceMessageKeys = {
  [PaymentSource.admin_override]: 'payment_source_admin_override',
  [PaymentSource.legacy]: 'payment_source_legacy',
  [PaymentSource.stripe]: 'payment_source_stripe',
} as const satisfies Record<AdminUserPaymentHistoryRow['source'], string>;

const paymentCardTypeMessageKeys = {
  [SailingCardType.normal]: 'payment_card_type_normal',
  [SailingCardType.racing]: 'payment_card_type_racing',
  [SailingCardType.team_racing]: 'payment_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

function paymentHistoryTitle(
  payment: AdminUserPaymentHistoryRow,
  t: Awaited<ReturnType<typeof getTranslations>>
): string {
  if (
    payment.purpose === 'membership' &&
    payment.cardType &&
    payment.cardYear
  ) {
    return t('payment_title_membership', {
      cardType: t(paymentCardTypeMessageKeys[payment.cardType]),
      year: payment.cardYear,
    });
  }
  return payment.title;
}

function AdminUserPaymentManualEvidence(props: {
  readonly emptyValue: string;
  readonly locale: string;
  readonly payment: AdminUserPaymentHistoryRow;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (!props.payment.manualHandledAt && !props.payment.manualHandledNote) {
    return null;
  }

  return (
    <span className="mt-1 block text-xs text-mit-readable-ink">
      {props.payment.manualHandledAt
        ? props.t('payment_manual_meta', {
            admin: props.payment.manualHandledByName ?? props.emptyValue,
            date: formatAdminDate(props.payment.manualHandledAt, props.locale),
          })
        : props.emptyValue}
      {props.payment.manualHandledNote ? (
        <span className="block">
          {props.t('payment_manual_note', {
            note: props.payment.manualHandledNote,
          })}
        </span>
      ) : null}
    </span>
  );
}

function adminPaymentReceiptFallback(
  payment: AdminUserPaymentHistoryRow,
  t: Awaited<ReturnType<typeof getTranslations>>
) {
  if (payment.source === PaymentSource.legacy && payment.status === 'paid') {
    return t('payment_no_stripe_receipt');
  }
  return t('empty_value');
}

function AdminUserPaymentHistoryPanel(props: {
  readonly loadFailed: boolean;
  readonly locale: string;
  readonly rows: AdminUserPaymentHistoryRow[];
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold" id="membership-payment-status">
        {props.t('payments_heading')}
      </h2>
      {props.loadFailed ? (
        <output className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {props.t('payments_load_failed')}
        </output>
      ) : null}
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{props.t('payment_column_title')}</TableHead>
              <TableHead>{props.t('payment_column_purpose')}</TableHead>
              <TableHead>{props.t('payment_column_status')}</TableHead>
              <TableHead>{props.t('payment_column_amount')}</TableHead>
              <TableHead>{props.t('payment_column_date')}</TableHead>
              <TableHead>{props.t('payment_column_source')}</TableHead>
              <TableHead>{props.t('payment_column_receipt')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7}>{props.t('payments_empty')}</TableCell>
              </TableRow>
            ) : (
              props.rows.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="font-medium">
                    {payment.detailHref ? (
                      <a className="underline" href={payment.detailHref}>
                        {payment.title}
                      </a>
                    ) : (
                      paymentHistoryTitle(payment, props.t)
                    )}
                  </TableCell>
                  <TableCell>
                    {props.t(paymentPurposeMessageKeys[payment.purpose])}
                  </TableCell>
                  <TableCell>
                    {props.t(paymentStatusMessageKeys[payment.status])}
                  </TableCell>
                  <TableCell>
                    {formatUsdMinorUnitsAsCurrency(
                      payment.amountCents,
                      props.locale
                    )}
                  </TableCell>
                  <TableCell>
                    {formatAdminDate(payment.createdAt, props.locale)}
                  </TableCell>
                  <TableCell>
                    {props.t(paymentSourceMessageKeys[payment.source])}
                    <AdminUserPaymentManualEvidence
                      emptyValue={props.t('empty_value')}
                      locale={props.locale}
                      payment={payment}
                      t={props.t}
                    />
                  </TableCell>
                  <TableCell>
                    {payment.receiptHref ? (
                      <a
                        className="underline"
                        href={payment.receiptHref}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        {props.t('payment_receipt_link')}
                      </a>
                    ) : (
                      adminPaymentReceiptFallback(payment, props.t)
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function AdminUserCurrentBlockers(props: {
  readonly blockers: AdminUserMembershipBlocker[];
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (props.blockers.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="admin-user-current-blockers"
      className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
    >
      <h2 className="m-0 font-semibold" id="admin-user-current-blockers">
        {props.t('current_blockers_heading')}
      </h2>
      <ul className="mt-2 space-y-1 p-0">
        {props.blockers.map((blocker) => (
          <li className="list-none" key={blocker.key}>
            <a className="font-medium underline" href={blocker.href}>
              {props.t(blocker.key)}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function currentMembershipPaymentAccess(
  rows: readonly AdminUserPaymentHistoryRow[]
) {
  const cardYear = getCurrentSailingCardYear();
  return latestMembershipPaymentAccess({ cardYear, rows });
}

export async function generateMetadata(
  props: AdminUserShowPageProps
): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({ locale, namespace: 'MitSailingRoutes' });
  return { title: t('meta_title_admin_users_show') };
}

export default async function AdminUserShowPage(props: AdminUserShowPageProps) {
  const { locale, id } = await props.params;
  const searchParams = await props.searchParams;
  setRequestLocale(locale);
  const session = await requirePermission(Permission.USERS_VIEW, locale);
  const role = appRoleFromSessionUser(session.user);
  const permissions = getAppRolePermissions(role);
  const canAssignRatings = hasPermission(
    permissions,
    Permission.RATINGS_ASSIGN
  );
  const canEditUsers = hasPermission(permissions, Permission.USERS_EDIT);
  const canAssignCards = hasPermission(
    permissions,
    Permission.CARDS_ASSIGN_NUMBER
  );
  const canExpireCards = hasPermission(permissions, Permission.CARDS_EXPIRE);
  const canPrintCards = hasPermission(permissions, Permission.CARDS_PRINT);

  const user = await usersAdminHandlers.getById(id);
  if (!user) {
    notFound();
  }
  const userEmail = typeof user.email === 'string' ? user.email : '';
  const cardYear = getCurrentSailingCardYear();
  const [sailingCardDetails, ratingDetails, emailDetails, paymentDetails] =
    await Promise.all([
      loadAdminUserSailingCardDetails(id),
      loadAdminUserRatingDetails(id),
      loadAdminUserEmailDetails({ email: userEmail, userId: id }),
      loadAdminUserPaymentDetails(id),
    ]);
  const shouldLoadSuggestedCardNumber =
    canAssignCards &&
    currentPendingSailingCardRequest(sailingCardDetails.summary) !== undefined;
  const suggestedCardNumber = shouldLoadSuggestedCardNumber
    ? await getNextAvailableSailingCardNumber({ cardYear })
    : 0;
  const t = await getTranslations({ locale, namespace: 'AdminUsers' });
  const tOnboarding = await getTranslations({
    locale,
    namespace: 'OnboardingPage',
  });
  const emailStatus = emailDeliverabilityStatus(user.emailDeliverabilityStatus);
  const emailStatusReason =
    typeof user.emailSuppressionReason === 'string'
      ? user.emailSuppressionReason
      : emailStatus;
  const hasEmailDeliverabilityWarning = emailStatus !== 'ok';
  const userFirstName =
    typeof user.firstName === 'string' ? user.firstName : '';
  const userLastName = typeof user.lastName === 'string' ? user.lastName : '';
  const userProfileName =
    `${userFirstName} ${userLastName}`.trim() || user.name;
  const userSailingAffiliation = isSailingAffiliation(user.sailingAffiliation)
    ? tOnboarding(userSailingAffiliationLabelKey(user.sailingAffiliation))
    : t('empty_value');
  const userIdentitySource =
    typeof user.mitDataWarehouseVerifiedAt === 'string'
      ? t('identity_source_mit_id')
      : t('identity_source_manual');
  const blockers = adminUserMembershipBlockers({
    cardRequest:
      currentPendingSailingCardRequest(sailingCardDetails.summary) ??
      sailingCardDetails.summary?.paymentBypassRequest ??
      null,
    introClassRequired: false,
    membershipAccess: currentMembershipPaymentAccess(paymentDetails.rows),
    recreationVerificationRequired: false,
  });

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminPageHeader
        actions={
          canEditUsers ? (
            <AdminPrimaryActionLink href={adminUsersEditPath(id)}>
              {t('action_edit')}
            </AdminPrimaryActionLink>
          ) : undefined
        }
        title={user.name}
      />
      <AdminUserCurrentBlockers blockers={blockers} t={t} />
      <div className="rounded-lg border border-border bg-card p-5 text-sm text-foreground">
        <dl className="m-0 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="font-semibold">{t('identity_name')}</dt>
            <dd className="m-0">{userProfileName}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('identity_affiliation')}</dt>
            <dd className="m-0">{userSailingAffiliation}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('identity_source')}</dt>
            <dd className="m-0">{userIdentitySource}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_email')}</dt>
            <dd className="m-0">{userEmail}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_mit_id')}</dt>
            <dd className="m-0">{user.mitId ?? t('empty_value')}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_sailing_card_number')}</dt>
            <dd className="m-0">
              {user.sailingCardNumber ?? t('empty_value')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">{t('identity_mit_class_year')}</dt>
            <dd className="m-0">{user.mitClassYear ?? t('empty_value')}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_role')}</dt>
            <dd className="m-0">{user.appRole}</dd>
          </div>
          <div>
            <dt className="font-semibold">{t('column_email_verified')}</dt>
            <dd className="m-0">
              {user.emailVerified ? t('boolean_yes') : t('boolean_no')}
            </dd>
          </div>
        </dl>
      </div>
      {hasEmailDeliverabilityWarning ? (
        <output className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-semibold">{t('email_status_warning_title')}</p>
          <p className="mt-1">
            {t('email_status_warning_body', {
              reason: emailStatusReason,
            })}
          </p>
        </output>
      ) : null}
      <AdminUserSailingCardSection
        canAssignCards={canAssignCards}
        canExpireCards={canExpireCards}
        canPrintCards={canPrintCards}
        history={sailingCardDetails.history}
        loadError={sailingCardDetails.loadError}
        locale={locale}
        paymentRows={paymentDetails.rows}
        suggestedCardNumber={suggestedCardNumber}
        summary={sailingCardDetails.summary}
        t={t}
        userId={id}
      />
      <AdminUserRatingsPanel
        canAssignRatings={canAssignRatings}
        errorCode={searchParams.error}
        locale={locale}
        ratingsLoadFailed={ratingDetails.loadError}
        rows={ratingDetails.rows}
        userId={id}
      />
      <AdminUserPaymentHistoryPanel
        loadFailed={paymentDetails.loadError}
        locale={locale}
        rows={paymentDetails.rows}
        t={t}
      />
      <AdminUserEmailsPanel
        emails={emailDetails.messages}
        loadFailed={emailDetails.loadError}
        locale={locale}
        t={t}
      />
    </div>
  );
}
