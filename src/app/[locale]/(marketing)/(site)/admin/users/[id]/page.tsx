import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type * as React from 'react';
import {
  AdminResponsiveColumnLabel,
  AdminSummaryRows,
  AdminTableContainer,
} from '@/components/mit-sailing/admin/AdminDataRows';
import type { AdminDataRowItem } from '@/components/mit-sailing/admin/AdminDataRows';
import { AdminPageHeader } from '@/components/mit-sailing/admin/AdminPageHeader';
import {
  AdminPagination,
  adminPaginationPage,
} from '@/components/mit-sailing/admin/AdminPagination';
import {
  AdminSailingCardChangeNumberForm,
  AdminSailingCardExpireForm,
  AdminSailingCardHistory,
  AdminSailingCardIssueForm,
  AdminSailingCardPrintActions,
} from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import type { AdminSailingCardPaymentAccess } from '@/components/mit-sailing/admin/cards/AdminSailingCardControls';
import { AdminUserRatingsPanel } from '@/components/mit-sailing/admin/users/AdminUserRatingsPanel';
import { PaymentAmountDisplay } from '@/components/mit-sailing/payments/PaymentAmountDisplay';
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
import { adminUsersShowPath } from '@/libs/admin/users/adminUserPaths';
import {
  ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE,
  listAdminUserCurrentMembershipPaymentAccessHistory,
  listAdminUserPaymentHistoryPage,
} from '@/libs/admin/users/adminUserPaymentHistory';
import type { AdminUserPaymentHistoryRow } from '@/libs/admin/users/adminUserPaymentHistory';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import {
  getAppRolePermissions,
  hasPermission,
  Permission,
} from '@/libs/auth/appPermissions';
import { appRoleFromSessionUser, requirePermission } from '@/libs/auth/dal';
import {
  ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE,
  getAdminUserEmailMessagesPage,
} from '@/libs/email/emailMessages';
import type { AdminUserEmailMessageRow } from '@/libs/email/emailMessages';
import { logger } from '@/libs/Logger';
import { membershipPaymentAccessStatus } from '@/libs/mit-sailing/membershipBilling/membershipPaymentStatus';
import { needsFitnessMembershipQuestion } from '@/libs/mit-sailing/sailingCardMembership';
import {
  getCurrentSailingCardYear,
  hasCurrentSailingCard,
} from '@/libs/mit-sailing/sailingCardValidity';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type AdminUserShowPageProps = Readonly<{
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    emailsPage?: string | string[];
    error?: string | string[];
    paymentsPage?: string | string[];
    ratingsPage?: string | string[];
  }>;
}>;

const ADMIN_USER_RATINGS_PAGE_SIZE = 25;

type AdminPaginationParams = Record<string, string | number | null | undefined>;

type AdminPaginationModel = {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

function searchParamString(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value.at(0)?.trim() ?? '';
  }
  return value?.trim() ?? '';
}

function optionalSearchParamString(value: string | string[] | undefined) {
  const selected = searchParamString(value);
  return selected.length > 0 ? selected : undefined;
}

function pageParamValue(page: number) {
  return page > 1 ? page : undefined;
}

function adminPaginationSummary(props: AdminPaginationModel) {
  if (props.total === 0) {
    return { end: 0, start: 0 };
  }
  const start = (props.page - 1) * props.pageSize + 1;
  return {
    end: Math.min(props.total, start + props.pageSize - 1),
    start,
  };
}

function AdminUserPanelPagination(props: {
  readonly basePath: string;
  readonly pageParamName: string;
  readonly pagination: AdminPaginationModel;
  readonly params: AdminPaginationParams;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  if (props.pagination.total <= props.pagination.pageSize) {
    return null;
  }
  const range = adminPaginationSummary(props.pagination);
  return (
    <AdminPagination
      basePath={props.basePath}
      labels={{
        next: props.t('pagination_next'),
        previous: props.t('pagination_previous'),
        summary: props.t('pagination_summary', {
          end: range.end,
          start: range.start,
          total: props.pagination.total,
        }),
      }}
      page={props.pagination.page}
      pageParamName={props.pageParamName}
      pageSize={props.pagination.pageSize}
      params={props.params}
      total={props.pagination.total}
    />
  );
}

function paginatedRows<T>(props: {
  readonly page: number;
  readonly pageSize: number;
  readonly rows: readonly T[];
}) {
  const total = props.rows.length;
  const totalPages = Math.max(1, Math.ceil(total / props.pageSize));
  const page = Math.min(Math.max(props.page, 1), totalPages);
  const start = (page - 1) * props.pageSize;
  return {
    page,
    pageSize: props.pageSize,
    rows: props.rows.slice(start, start + props.pageSize),
    total,
  };
}

type AdminUserIdentitySummaryInput = {
  readonly emergencyContactName?: unknown;
  readonly emergencyContactPhone?: unknown;
  readonly firstName?: unknown;
  readonly lastName?: unknown;
  readonly name?: unknown;
  readonly phone?: unknown;
};

function nonEmptyStringOr(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

function adminUserIdentitySummary(
  user: AdminUserIdentitySummaryInput,
  emptyValue: string
) {
  const firstName = typeof user.firstName === 'string' ? user.firstName : '';
  const lastName = typeof user.lastName === 'string' ? user.lastName : '';
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    emergencyContactName: nonEmptyStringOr(
      user.emergencyContactName,
      emptyValue
    ),
    emergencyContactPhone: nonEmptyStringOr(
      user.emergencyContactPhone,
      emptyValue
    ),
    phone: nonEmptyStringOr(user.phone, emptyValue),
    profileName: fullName || nonEmptyStringOr(user.name, emptyValue),
  };
}

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
    (Object.values(SailingAffiliation) as readonly string[]).includes(value)
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
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
};

type AdminUserPaymentDetails = {
  readonly accessRows: AdminUserPaymentHistoryRow[];
  readonly loadError: boolean;
  readonly page: number;
  readonly pageSize: number;
  readonly rows: AdminUserPaymentHistoryRow[];
  readonly total: number;
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
  readonly page: number;
  readonly userId: string;
}): Promise<AdminUserEmailDetails> {
  try {
    const emailPage = await getAdminUserEmailMessagesPage({
      ...props,
      pageSize: ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE,
    });
    return {
      loadError: false,
      messages: emailPage.rows,
      page: emailPage.page,
      pageSize: emailPage.pageSize,
      total: emailPage.total,
    };
  } catch (error) {
    logger.error('Failed to load admin user email message rows: {error}', {
      error,
      userId: props.userId,
    });
    return {
      loadError: true,
      messages: [],
      page: 1,
      pageSize: ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE,
      total: 0,
    };
  }
}

async function loadAdminUserPaymentDetails(props: {
  readonly cardYear: number;
  readonly page: number;
  readonly userId: string;
}): Promise<AdminUserPaymentDetails> {
  try {
    const [historyPage, accessRows] = await Promise.all([
      listAdminUserPaymentHistoryPage({
        page: props.page,
        pageSize: ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE,
        userId: props.userId,
      }),
      listAdminUserCurrentMembershipPaymentAccessHistory({
        cardYear: props.cardYear,
        userId: props.userId,
      }),
    ]);
    return {
      accessRows,
      loadError: false,
      page: historyPage.page,
      pageSize: historyPage.pageSize,
      rows: historyPage.rows,
      total: historyPage.total,
    };
  } catch (error) {
    logger.error('Failed to load admin user payment rows: {error}', {
      error,
      userId: props.userId,
    });
    return {
      accessRows: [],
      loadError: true,
      page: 1,
      pageSize: ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE,
      rows: [],
      total: 0,
    };
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

function AdminUserInlineDetailValue(props: {
  readonly label: string;
  readonly value: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-1.5">
      <dt className="shrink-0 text-muted-foreground">{props.label}</dt>
      <dd className="m-0 min-w-0 font-medium break-words">{props.value}</dd>
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
  readonly displayedCardNumber: React.ReactNode;
  readonly emptyValue: string;
  readonly hasCurrentCard: boolean;
  readonly issuePaymentAccess: AdminSailingCardPaymentAccess | undefined;
  readonly latestRequest: AdminUserSailingCardRequestSummary | undefined;
  readonly needsRecreationVerification: boolean;
  readonly pendingCardNumber: number;
  readonly pendingRequest: AdminUserSailingCardRequestSummary | undefined;
  readonly summary: AdminUserSailingCardSummary;
};

function pendingRequestNeedsRecreationVerification(props: {
  readonly request: AdminUserSailingCardRequestSummary | undefined;
  readonly summary: AdminUserSailingCardSummary;
}) {
  if (!props.request) {
    return false;
  }

  return (
    props.request.cardType === SailingCardType.normal &&
    props.summary?.gymMembershipVerifiedAt === null &&
    needsFitnessMembershipQuestion(props.request.sailingAffiliation)
  );
}

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
    needsRecreationVerification: pendingRequestNeedsRecreationVerification({
      request: pendingRequest,
      summary: props.summary,
    }),
    pendingCardNumber:
      pendingRequest?.issuedCardNumber ?? props.suggestedCardNumber,
    pendingRequest,
    summary: props.summary,
  };
}

function AdminUserPendingSailingCardIssueAction(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly userId: string;
}) {
  if (!props.canAssignCards) {
    return null;
  }
  if (props.model.pendingRequest) {
    return (
      <div className="w-full sm:w-auto">
        <AdminSailingCardIssueForm
          cardType={props.model.pendingRequest.cardType}
          locale={props.locale}
          needsRecreationVerification={props.model.needsRecreationVerification}
          paymentAccess={props.model.issuePaymentAccess}
          suggestedCardNumber={props.model.pendingCardNumber}
          userId={props.userId}
        />
      </div>
    );
  }

  return null;
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

function AdminUserSailingCardStatusPanel(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
  readonly userId: string;
}) {
  const cardNumber = props.model.pendingRequest
    ? props.t('sailing_card_assignment_pending')
    : props.model.displayedCardNumber;

  return (
    <div className="mt-3 flex flex-wrap items-start justify-between gap-3 border-t border-border pt-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-foreground">
          {props.t(
            sailingCardStatusMessageKey({
              hasCurrentCard: props.model.hasCurrentCard,
              request: props.model.latestRequest,
            })
          )}
        </p>
        <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <AdminUserInlineDetailValue
            label={props.t('sailing_card_number')}
            value={cardNumber}
          />
          <AdminUserInlineDetailValue
            label={props.t('sailing_card_type')}
            value={sailingCardTypeValue({
              emptyValue: props.model.emptyValue,
              request: props.model.latestRequest,
              t: props.t,
            })}
          />
          <AdminUserInlineDetailValue
            label={props.t('sailing_card_year')}
            value={
              props.model.pendingRequest?.cardYear ??
              props.model.latestRequest?.cardYear ??
              props.model.summary?.sailingCardYear ??
              props.model.emptyValue
            }
          />
        </dl>
      </div>
      <AdminUserPendingSailingCardIssueAction
        canAssignCards={props.canAssignCards}
        locale={props.locale}
        model={props.model}
        userId={props.userId}
      />
    </div>
  );
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
    <dl className="mt-3 grid gap-x-5 gap-y-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
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

function AdminUserCurrentSailingCardNumberAction(props: {
  readonly canAssignCards: boolean;
  readonly locale: string;
  readonly model: AdminUserSailingCardSectionModel;
  readonly userId: string;
}) {
  const cardNumber = props.model.summary?.sailingCardNumber;
  if (!props.canAssignCards || !props.model.hasCurrentCard || !cardNumber) {
    return null;
  }

  return (
    <div className="mt-3 max-w-sm">
      <AdminSailingCardChangeNumberForm
        currentCardNumber={cardNumber}
        locale={props.locale}
        userId={props.userId}
      />
    </div>
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
      <section className="border-t border-border pt-5 text-sm text-foreground">
        <h2 className="m-0 text-lg font-semibold" id="sailing-card-status">
          {props.t('sailing_card_heading')}
        </h2>
        {props.loadError ? (
          <output className="mt-3 block rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {props.t('sailing_card_load_failed')}
          </output>
        ) : null}
        <AdminUserSailingCardStatusPanel
          canAssignCards={props.canAssignCards}
          locale={props.locale}
          model={model}
          t={props.t}
          userId={props.userId}
        />
        {props.canPrintCards && model.hasCurrentCard ? (
          <div className="mt-3">
            <AdminSailingCardPrintActions userId={props.userId} />
          </div>
        ) : null}
        <AdminUserCurrentSailingCardNumberAction
          canAssignCards={props.canAssignCards}
          locale={props.locale}
          model={model}
          userId={props.userId}
        />
        <AdminUserSailingCardDetailsList
          locale={props.locale}
          model={model}
          summary={props.summary}
          t={props.t}
        />
        {props.canExpireCards && model.hasCurrentCard ? (
          <div className="mt-3">
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
      <AdminTableContainer>
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
      </AdminTableContainer>
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

function AdminUserPaymentAmount(props: {
  readonly locale: string;
  readonly payment: AdminUserPaymentHistoryRow;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return (
    <PaymentAmountDisplay
      labels={{
        amountPaidOfTotal: (values) =>
          props.t('payment_amount_paid_of_total', values),
        discountApplied: props.t('payment_discount_applied'),
        discountSummary: (values) =>
          props.t('payment_discount_summary', values),
        partialRefundSummary: (values) =>
          props.t('payment_amount_partial_refund', values),
      }}
      locale={props.locale}
      payment={props.payment}
    />
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
      {props.rows.length === 0 ? (
        <p className="m-0 border-y border-border py-3 text-sm text-mit-readable-ink">
          {props.t('payments_empty')}
        </p>
      ) : (
        <div className="border-y border-border">
          <div className="hidden grid-cols-[minmax(0,1.7fr)_7rem_9rem_8rem_9rem] gap-3 border-b border-border py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>{props.t('payment_column_title')}</span>
            <span>{props.t('payment_column_status')}</span>
            <span>{props.t('payment_column_amount')}</span>
            <span>{props.t('payment_column_date')}</span>
            <span>{props.t('payment_column_source')}</span>
          </div>
          <ol className="m-0 list-none divide-y divide-border p-0 text-sm">
            {props.rows.map((payment) => (
              <li
                className="grid gap-3 py-3 md:grid-cols-[minmax(0,1.7fr)_7rem_9rem_8rem_9rem] md:items-start"
                key={payment.id}
              >
                <div className="min-w-0">
                  <p className="m-0 font-medium break-words">
                    {payment.detailHref ? (
                      <a className="underline" href={payment.detailHref}>
                        {payment.title}
                      </a>
                    ) : (
                      paymentHistoryTitle(payment, props.t)
                    )}
                  </p>
                  <p className="mt-1 text-xs text-mit-readable-ink">
                    {props.t(paymentPurposeMessageKeys[payment.purpose])}
                  </p>
                </div>
                <div>
                  <AdminResponsiveColumnLabel
                    label={props.t('payment_column_status')}
                  />
                  <p className="m-0">
                    {props.t(paymentStatusMessageKeys[payment.status])}
                  </p>
                </div>
                <div>
                  <AdminResponsiveColumnLabel
                    label={props.t('payment_column_amount')}
                  />
                  <AdminUserPaymentAmount
                    locale={props.locale}
                    payment={payment}
                    t={props.t}
                  />
                </div>
                <div>
                  <AdminResponsiveColumnLabel
                    label={props.t('payment_column_date')}
                  />
                  <p className="m-0">
                    {formatAdminDate(payment.createdAt, props.locale)}
                  </p>
                </div>
                <div>
                  <AdminResponsiveColumnLabel
                    label={props.t('payment_column_source')}
                  />
                  <p className="m-0">
                    {props.t(paymentSourceMessageKeys[payment.source])}
                  </p>
                  <AdminUserPaymentManualEvidence
                    emptyValue={props.t('empty_value')}
                    locale={props.locale}
                    payment={payment}
                    t={props.t}
                  />
                  <p className="mt-1">
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
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
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
  const userShowPath = adminUsersShowPath(id);
  const requestedEmailsPage = adminPaginationPage(
    searchParamString(searchParams.emailsPage)
  );
  const requestedPaymentsPage = adminPaginationPage(
    searchParamString(searchParams.paymentsPage)
  );
  const requestedRatingsPage = adminPaginationPage(
    searchParamString(searchParams.ratingsPage)
  );
  const [sailingCardDetails, ratingDetails, emailDetails, paymentDetails] =
    await Promise.all([
      loadAdminUserSailingCardDetails(id),
      loadAdminUserRatingDetails(id),
      loadAdminUserEmailDetails({
        email: userEmail,
        page: requestedEmailsPage,
        userId: id,
      }),
      loadAdminUserPaymentDetails({
        cardYear,
        page: requestedPaymentsPage,
        userId: id,
      }),
    ]);
  const ratingsPage = paginatedRows({
    page: requestedRatingsPage,
    pageSize: ADMIN_USER_RATINGS_PAGE_SIZE,
    rows: ratingDetails.rows,
  });
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
  const identitySummary = adminUserIdentitySummary(user, t('empty_value'));
  const userSailingAffiliation = isSailingAffiliation(user.sailingAffiliation)
    ? tOnboarding(userSailingAffiliationLabelKey(user.sailingAffiliation))
    : t('empty_value');
  const userIdentitySource =
    typeof user.mitDataWarehouseVerifiedAt === 'string'
      ? t('identity_source_mit_id')
      : t('identity_source_manual');
  const userSummaryRows = [
    [
      { label: t('identity_name'), value: identitySummary.profileName },
      { label: t('column_email'), value: userEmail },
      { label: t('identity_phone'), value: identitySummary.phone },
    ],
    [
      { label: t('identity_affiliation'), value: userSailingAffiliation },
      { label: t('column_mit_id'), value: user.mitId ?? t('empty_value') },
      {
        label: t('identity_mit_class_year'),
        value: user.mitClassYear ?? t('empty_value'),
      },
    ],
    [
      {
        label: t('identity_emergency_contact_name'),
        value: identitySummary.emergencyContactName,
      },
      {
        label: t('identity_emergency_contact_phone'),
        value: identitySummary.emergencyContactPhone,
      },
      { label: t('column_role'), value: user.appRole },
    ],
    [
      { label: t('identity_source'), value: userIdentitySource },
      {
        label: t('column_email_verified'),
        value: user.emailVerified ? t('boolean_yes') : t('boolean_no'),
      },
      {
        label: t('column_sailing_card_number'),
        value: user.sailingCardNumber ?? t('empty_value'),
      },
    ],
  ] as const satisfies readonly (readonly AdminDataRowItem[])[];
  const blockers = adminUserMembershipBlockers({
    cardRequest:
      currentPendingSailingCardRequest(sailingCardDetails.summary) ?? null,
    introClassRequired: false,
    membershipAccess: currentMembershipPaymentAccess(paymentDetails.accessRows),
    recreationVerificationRequired: false,
  });
  const paginationParams = {
    emailsPage: pageParamValue(emailDetails.page),
    error: optionalSearchParamString(searchParams.error),
    paymentsPage: pageParamValue(paymentDetails.page),
    ratingsPage: pageParamValue(ratingsPage.page),
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminPageHeader title={user.name} />
      <AdminUserCurrentBlockers blockers={blockers} t={t} />
      <AdminSummaryRows rows={userSummaryRows} />
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
        errorCode={optionalSearchParamString(searchParams.error)}
        locale={locale}
        ratingsLoadFailed={ratingDetails.loadError}
        rows={ratingsPage.rows}
        userId={id}
      />
      <AdminUserPanelPagination
        basePath={userShowPath}
        pageParamName="ratingsPage"
        pagination={ratingsPage}
        params={paginationParams}
        t={t}
      />
      <AdminUserPaymentHistoryPanel
        loadFailed={paymentDetails.loadError}
        locale={locale}
        rows={paymentDetails.rows}
        t={t}
      />
      <AdminUserPanelPagination
        basePath={userShowPath}
        pageParamName="paymentsPage"
        pagination={paymentDetails}
        params={paginationParams}
        t={t}
      />
      <AdminUserEmailsPanel
        emails={emailDetails.messages}
        loadFailed={emailDetails.loadError}
        locale={locale}
        t={t}
      />
      <AdminUserPanelPagination
        basePath={userShowPath}
        pageParamName="emailsPage"
        pagination={emailDetails}
        params={paginationParams}
        t={t}
      />
    </div>
  );
}
