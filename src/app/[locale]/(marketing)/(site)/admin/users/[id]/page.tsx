import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import type * as React from 'react';
import {
  AdminResponsiveColumnLabel,
  AdminTableContainer,
} from '@/components/mit-sailing/admin/AdminDataRows';
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
import { AdminMemberDetailsClient } from '@/components/mit-sailing/admin/users/AdminMemberDetailsClient';
import { AdminUserAccountTabs } from '@/components/mit-sailing/admin/users/AdminUserAccountTabs';
import { AdminUserAdminTabPanel } from '@/components/mit-sailing/admin/users/AdminUserAdminTabPanel';
import { AdminUserProfileHeader } from '@/components/mit-sailing/admin/users/AdminUserProfileHeader';
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
  SailingAffiliation,
  SailingCardType,
} from '@/generated/prisma/enums';
import { formatAdminDate } from '@/libs/admin/adminDateFormatting';
import { getNextAvailableSailingCardNumber } from '@/libs/admin/cards/adminSailingCardQueries';
import {
  getAdminSailingCardHistory,
  getAdminUserSailingCardSummary,
} from '@/libs/admin/cards/adminSailingCardUiQueries';
import type { CatalogRow } from '@/libs/admin/catalog/types';
import { parseAdminUserAccountTab } from '@/libs/admin/users/adminUserAccountTab';
import type { AdminUserAccountTab } from '@/libs/admin/users/adminUserAccountTab';
import {
  adminUserCardWorkflowModel,
  currentPendingSailingCardRequest,
  latestMembershipPaymentAccess,
  pendingRequestNeedsRecreationVerification,
  sailingCardIssuePaymentAccess,
  sailingCardStatusMessageKey,
} from '@/libs/admin/users/adminUserCardWorkflow';
import type {
  AdminUserSailingCardRequestSummary,
  AdminUserSailingCardSummary,
} from '@/libs/admin/users/adminUserCardWorkflow';
import { adminUserMembershipBlockers } from '@/libs/admin/users/adminUserMembershipStatus';
import type { AdminUserMembershipBlocker } from '@/libs/admin/users/adminUserMembershipStatus';
import { adminUsersShowPath } from '@/libs/admin/users/adminUserPaths';
import {
  listAdminUserCurrentMembershipPaymentAccessHistory,
  listAdminUserPaymentHistoryPage,
} from '@/libs/admin/users/adminUserPaymentHistory';
import type { AdminUserPaymentHistoryRow } from '@/libs/admin/users/adminUserPaymentHistory';
import { usersAdminHandlers } from '@/libs/admin/users/usersAdminHandlers';
import {
  getAppRolePermissions,
  hasPermission,
  isAdminAppRole,
  Permission,
} from '@/libs/auth/appPermissions';
import { appRoleFromSessionUser, requirePermission } from '@/libs/auth/dal';
import { getAdminUserEmailMessages } from '@/libs/email/emailMessages';
import type { AdminUserEmailMessageRow } from '@/libs/email/emailMessages';
import { logger } from '@/libs/Logger';
import {
  getCurrentSailingCardYear,
  hasCurrentSailingCard,
} from '@/libs/mit-sailing/sailingCardValidity';
import { listUserRatingAssignmentRows } from '@/libs/mit-sailing/sailingRatingQueries';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';
import { getI18nPath } from '@/utils/Helpers';

type EmailDeliverabilityStatus = 'ok' | 'bounced' | 'suppressed';

type AdminUserShowPageProps = Readonly<{
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{
    emailsPage?: string | string[];
    error?: string | string[];
    paymentsPage?: string | string[];
    ratingsPage?: string | string[];
    tab?: string | string[];
  }>;
}>;

const ADMIN_USER_RATINGS_PAGE_SIZE = 25;
const ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE = 25;
const ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE = 25;

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

function resolveAdminUserAccountTab(props: {
  readonly canEditUsers: boolean;
  readonly canViewEmails: boolean;
  readonly canViewPayments: boolean;
  readonly requestedTab: AdminUserAccountTab;
}): AdminUserAccountTab {
  if (props.requestedTab === 'admin' && !props.canEditUsers) {
    return 'account';
  }
  if (props.requestedTab === 'payments' && !props.canViewPayments) {
    return 'account';
  }
  if (props.requestedTab === 'emails' && !props.canViewEmails) {
    return 'account';
  }
  return props.requestedTab;
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

function catalogStringValue(value: unknown) {
  return typeof value === 'string' ? value : '';
}

function nullableCatalogString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

function isSailingAffiliation(value: unknown): value is SailingAffiliation {
  return (
    typeof value === 'string' &&
    (Object.values(SailingAffiliation) as readonly string[]).includes(value)
  );
}

function adminUserIdentitySummary(
  user: AdminUserIdentitySummaryInput,
  emptyValue: string
) {
  const firstName = catalogStringValue(user.firstName);
  const lastName = catalogStringValue(user.lastName);
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

function adminUserShowAccess(role: ReturnType<typeof appRoleFromSessionUser>) {
  const permissions = getAppRolePermissions(role);
  return {
    canAssignCards: hasPermission(permissions, Permission.CARDS_ASSIGN_NUMBER),
    canAssignRatings: hasPermission(permissions, Permission.RATINGS_ASSIGN),
    canEditUsers: hasPermission(permissions, Permission.USERS_EDIT),
    canExpireCards: hasPermission(permissions, Permission.CARDS_EXPIRE),
    canPrintCards: hasPermission(permissions, Permission.CARDS_PRINT),
    canViewEmails: isAdminAppRole(role),
    canViewPayments: hasPermission(permissions, Permission.PAYMENTS_VIEW),
  };
}

function adminMemberDetailsInitialValues(user: CatalogRow) {
  return {
    emergencyContactName: catalogStringValue(user.emergencyContactName),
    emergencyContactPhone: catalogStringValue(user.emergencyContactPhone),
    firstName: catalogStringValue(user.firstName),
    lastName: catalogStringValue(user.lastName),
    mitClassYear: nullableCatalogString(user.mitClassYear),
    mitId: nullableCatalogString(user.mitId),
    phone: catalogStringValue(user.phone),
    roleLabel: catalogStringValue(user.appRole),
    sailingAffiliation: isSailingAffiliation(user.sailingAffiliation)
      ? user.sailingAffiliation
      : null,
  };
}

function emailDeliverabilityStatus(value: unknown): EmailDeliverabilityStatus {
  return value === 'bounced' || value === 'suppressed' ? value : 'ok';
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

type AdminUserSailingCardDetails = {
  readonly history: Awaited<ReturnType<typeof getAdminSailingCardHistory>>;
  readonly loadError: boolean;
  readonly summary: AdminUserSailingCardSummary | null;
};

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
    const messages = await getAdminUserEmailMessages({
      email: props.email,
      userId: props.userId,
    });
    const emailPage = paginatedRows({
      page: props.page,
      pageSize: ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE,
      rows: messages,
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

const sailingCardTypeMessageKeys = {
  [SailingCardType.normal]: 'sailing_card_type_normal',
  [SailingCardType.racing]: 'sailing_card_type_racing',
  [SailingCardType.team_racing]: 'sailing_card_type_team_racing',
} as const satisfies Record<SailingCardType, string>;

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
  readonly summary: AdminUserSailingCardSummary | null;
};

function adminUserSailingCardSectionModel(props: {
  readonly paymentRows: readonly AdminUserPaymentHistoryRow[];
  readonly suggestedCardNumber: number;
  readonly summary: AdminUserSailingCardSummary | null;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}): AdminUserSailingCardSectionModel {
  const hasCurrentCard =
    props.summary !== null && hasCurrentSailingCard(props.summary);
  const pendingRequest =
    currentPendingSailingCardRequest(props.summary) ?? undefined;
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
      request: pendingRequest ?? null,
      rows: props.paymentRows,
    }),
    latestRequest: pendingRequest ?? props.summary?.sailingCardRequests[0],
    needsRecreationVerification: pendingRequestNeedsRecreationVerification({
      request: pendingRequest ?? null,
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
  readonly summary: AdminUserSailingCardSummary | null;
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
  readonly summary: AdminUserSailingCardSummary | null;
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
  readonly summary: AdminUserSailingCardSummary | null;
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

function emptyAdminUserEmailDetails(): AdminUserEmailDetails {
  return {
    loadError: false,
    messages: [],
    page: 1,
    pageSize: ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE,
    total: 0,
  };
}

function adminUserAccountTabs(props: {
  readonly access: ReturnType<typeof adminUserShowAccess>;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
}) {
  return [
    { id: 'account' as const, label: props.t('tab_account') },
    ...(props.access.canViewPayments
      ? [{ id: 'payments' as const, label: props.t('tab_payments') }]
      : []),
    ...(props.access.canViewEmails
      ? [{ id: 'emails' as const, label: props.t('tab_emails') }]
      : []),
    ...(props.access.canEditUsers
      ? [{ id: 'admin' as const, label: props.t('tab_admin') }]
      : []),
  ];
}

function adminUserDisplayName(props: {
  readonly emptyValue: string;
  readonly name: unknown;
  readonly userEmail: string;
}) {
  if (typeof props.name === 'string' && props.name.trim().length > 0) {
    return props.name;
  }
  return props.userEmail || props.emptyValue;
}

async function suggestedSailingCardNumber(props: {
  readonly canAssignCards: boolean;
  readonly cardYear: number;
  readonly pendingCardRequest: AdminUserSailingCardRequestSummary | null;
}) {
  if (!props.canAssignCards || props.pendingCardRequest === null) {
    return 0;
  }
  const nextNumber = await getNextAvailableSailingCardNumber({
    cardYear: props.cardYear,
  });
  return nextNumber;
}

function AdminUserShowTabPanels(props: {
  readonly access: ReturnType<typeof adminUserShowAccess>;
  readonly activeTab: AdminUserAccountTab;
  readonly blockers: AdminUserMembershipBlocker[];
  readonly emailDetails: AdminUserEmailDetails;
  readonly emailStatusReason: string;
  readonly errorCode: string | undefined;
  readonly hasEmailDeliverabilityWarning: boolean;
  readonly identitySourceLabel: string;
  readonly locale: string;
  readonly memberDetails: ReturnType<typeof adminMemberDetailsInitialValues>;
  readonly mitIdentityLocked: boolean;
  readonly paginationParams: AdminPaginationParams;
  readonly paymentDetails: AdminUserPaymentDetails;
  readonly ratingDetails: AdminUserRatingDetails;
  readonly ratingsPage: ReturnType<
    typeof paginatedRows<UserRatingAssignmentRow>
  >;
  readonly sailingCardDetails: AdminUserSailingCardDetails;
  readonly suggestedCardNumber: number;
  readonly t: Awaited<ReturnType<typeof getTranslations>>;
  readonly user: CatalogRow;
  readonly userId: string;
  readonly userShowPath: string;
}) {
  if (props.activeTab === 'account') {
    return (
      <>
        <AdminMemberDetailsClient
          description={props.t('member_details_form_description')}
          emailVerifiedLabel={
            props.user.emailVerified
              ? props.t('email_verified_badge')
              : props.t('email_unverified_badge')
          }
          heading={props.t('account_panel_heading')}
          identitySourceLabel={props.identitySourceLabel}
          initialEmergencyContactName={props.memberDetails.emergencyContactName}
          initialEmergencyContactPhone={
            props.memberDetails.emergencyContactPhone
          }
          initialFirstName={props.memberDetails.firstName}
          initialLastName={props.memberDetails.lastName}
          initialMitClassYear={props.memberDetails.mitClassYear}
          initialMitId={props.memberDetails.mitId}
          initialMitIdentityLocked={props.mitIdentityLocked}
          initialPhone={props.memberDetails.phone}
          initialSailingAffiliation={props.memberDetails.sailingAffiliation}
          locale={props.locale}
          roleLabel={props.memberDetails.roleLabel}
          userId={props.userId}
        />
        <AdminUserCurrentBlockers blockers={props.blockers} t={props.t} />
        {props.hasEmailDeliverabilityWarning ? (
          <output className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">
              {props.t('email_status_warning_title')}
            </p>
            <p className="mt-1">
              {props.t('email_status_warning_body', {
                reason: props.emailStatusReason,
              })}
            </p>
          </output>
        ) : null}
        <AdminUserSailingCardSection
          canAssignCards={props.access.canAssignCards}
          canExpireCards={props.access.canExpireCards}
          canPrintCards={props.access.canPrintCards}
          history={props.sailingCardDetails.history}
          loadError={props.sailingCardDetails.loadError}
          locale={props.locale}
          paymentRows={props.paymentDetails.accessRows}
          suggestedCardNumber={props.suggestedCardNumber}
          summary={props.sailingCardDetails.summary}
          t={props.t}
          userId={props.userId}
        />
        <AdminUserRatingsPanel
          canAssignRatings={props.access.canAssignRatings}
          errorCode={props.errorCode}
          locale={props.locale}
          ratingsLoadFailed={props.ratingDetails.loadError}
          rows={props.ratingsPage.rows}
          userId={props.userId}
        />
        <AdminUserPanelPagination
          basePath={props.userShowPath}
          pageParamName="ratingsPage"
          pagination={props.ratingsPage}
          params={props.paginationParams}
          t={props.t}
        />
      </>
    );
  }

  if (props.activeTab === 'payments' && props.access.canViewPayments) {
    return (
      <>
        <AdminUserPaymentHistoryPanel
          loadFailed={props.paymentDetails.loadError}
          locale={props.locale}
          rows={props.paymentDetails.rows}
          t={props.t}
        />
        <AdminUserPanelPagination
          basePath={props.userShowPath}
          pageParamName="paymentsPage"
          pagination={props.paymentDetails}
          params={props.paginationParams}
          t={props.t}
        />
      </>
    );
  }

  if (props.activeTab === 'emails' && props.access.canViewEmails) {
    return (
      <>
        <AdminUserEmailsPanel
          emails={props.emailDetails.messages}
          loadFailed={props.emailDetails.loadError}
          locale={props.locale}
          t={props.t}
        />
        <AdminUserPanelPagination
          basePath={props.userShowPath}
          pageParamName="emailsPage"
          pagination={props.emailDetails}
          params={props.paginationParams}
          t={props.t}
        />
      </>
    );
  }

  if (props.activeTab === 'admin' && props.access.canEditUsers) {
    return (
      <AdminUserAdminTabPanel
        errorCode={props.errorCode}
        locale={props.locale}
        row={props.user}
        userId={props.userId}
      />
    );
  }

  return null;
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
  const access = adminUserShowAccess(appRoleFromSessionUser(session.user));
  const accountHref = getI18nPath('/', locale);

  const user = await usersAdminHandlers.getById(id);
  if (!user) {
    notFound();
  }
  const userEmail = catalogStringValue(user.email);
  const memberDetails = adminMemberDetailsInitialValues(user);
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
      access.canViewEmails
        ? loadAdminUserEmailDetails({
            email: userEmail,
            page: requestedEmailsPage,
            userId: id,
          })
        : Promise.resolve(emptyAdminUserEmailDetails()),
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
  const pendingCardRequest = currentPendingSailingCardRequest(
    sailingCardDetails.summary
  );
  const suggestedCardNumber = await suggestedSailingCardNumber({
    canAssignCards: access.canAssignCards,
    cardYear,
    pendingCardRequest,
  });
  const t = await getTranslations({ locale, namespace: 'AdminUsers' });
  const emailStatus = emailDeliverabilityStatus(user.emailDeliverabilityStatus);
  const emailStatusReason =
    typeof user.emailSuppressionReason === 'string'
      ? user.emailSuppressionReason
      : emailStatus;
  const hasEmailDeliverabilityWarning = emailStatus !== 'ok';
  const identitySummary = adminUserIdentitySummary(user, t('empty_value'));
  const userIdentitySource =
    typeof user.mitDataWarehouseVerifiedAt === 'string'
      ? t('identity_source_mit_id')
      : t('identity_source_manual');
  const displayName = adminUserDisplayName({
    emptyValue: t('empty_value'),
    name: user.name,
    userEmail,
  });
  const mitIdentityLocked =
    memberDetails.mitId !== null && user.mitDataWarehouseVerifiedAt !== null;
  const blockers = adminUserMembershipBlockers({
    cardRequest: pendingCardRequest,
    introClassRequired: false,
    membershipAccess: currentMembershipPaymentAccess(paymentDetails.accessRows),
    recreationVerificationRequired: pendingRequestNeedsRecreationVerification({
      request: pendingCardRequest,
      summary: sailingCardDetails.summary,
    }),
  });
  const cardWorkflow = adminUserCardWorkflowModel({
    paymentRows: paymentDetails.accessRows,
    suggestedCardNumber,
    summary: sailingCardDetails.summary,
  });
  const cardStatusLabel = cardWorkflow
    ? t(cardWorkflow.statusMessageKey)
    : t('sailing_card_status_none');
  const requestedTab = parseAdminUserAccountTab(searchParams.tab);
  const activeTab = resolveAdminUserAccountTab({
    canEditUsers: access.canEditUsers,
    canViewEmails: access.canViewEmails,
    canViewPayments: access.canViewPayments,
    requestedTab,
  });
  const accountTabs = adminUserAccountTabs({ access, t });
  const errorCode = optionalSearchParamString(searchParams.error);
  const paginationParams = {
    emailsPage: pageParamValue(emailDetails.page),
    error: errorCode,
    paymentsPage: pageParamValue(paymentDetails.page),
    ratingsPage: pageParamValue(ratingsPage.page),
    tab: activeTab === 'account' ? undefined : activeTab,
  };

  return (
    <div className="flex w-full max-w-5xl flex-col gap-6">
      <AdminUserProfileHeader
        accountRedirectHref={accountHref}
        canEditUsers={access.canEditUsers}
        canImpersonate={access.canEditUsers}
        canPrintCards={access.canPrintCards}
        cardNumber={cardWorkflow?.cardNumber ?? null}
        cardStatusLabel={cardStatusLabel}
        currentUserId={session.user.id}
        displayName={displayName}
        email={userEmail}
        hasCurrentCard={cardWorkflow?.hasCurrentCard ?? false}
        locale={locale}
        pdfHref={`${userShowPath}/sailing-card/print`}
        phone={identitySummary.phone}
        showEditAction={false}
        userId={id}
      />
      <AdminUserAccountTabs
        activeTab={activeTab}
        ariaLabel={t('account_tabs_aria_label')}
        tabs={accountTabs}
        userId={id}
      />
      <AdminUserShowTabPanels
        access={access}
        activeTab={activeTab}
        blockers={blockers}
        emailDetails={emailDetails}
        emailStatusReason={emailStatusReason}
        errorCode={errorCode}
        hasEmailDeliverabilityWarning={hasEmailDeliverabilityWarning}
        identitySourceLabel={userIdentitySource}
        locale={locale}
        memberDetails={memberDetails}
        mitIdentityLocked={mitIdentityLocked}
        paginationParams={paginationParams}
        paymentDetails={paymentDetails}
        ratingDetails={ratingDetails}
        ratingsPage={ratingsPage}
        sailingCardDetails={sailingCardDetails}
        suggestedCardNumber={suggestedCardNumber}
        t={t}
        user={user}
        userId={id}
        userShowPath={userShowPath}
      />
    </div>
  );
}
