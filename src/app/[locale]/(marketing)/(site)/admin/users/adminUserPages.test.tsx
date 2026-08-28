import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PaymentSource,
  SailingAffiliation,
  SailingCardRequestStatus,
  SailingCardType,
} from '@/generated/prisma/enums';
import { Permission } from '@/libs/auth/permissions';
import { Role } from '@/libs/auth/roles';
import {
  sailingCardAgreement,
  sailingCardAgreementHash,
} from '@/libs/mit-sailing/sailingCardAgreement';

const mocks = vi.hoisted(() => ({
  createAdminUserAction: vi.fn(),
  deleteAdminUserAction: vi.fn(),
  getById: vi.fn(),
  getAdminUserEmailMessages: vi.fn(),
  getAdminSailingCardHistory: vi.fn(),
  getAdminUserSailingCardSummary: vi.fn(),
  getNextAvailableSailingCardNumber: vi.fn(),
  listAdminUserCurrentMembershipPaymentAccessHistory: vi.fn(),
  listAdminUserPaymentHistory: vi.fn(),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  list: vi.fn(),
  listUserRatingAssignmentRows: vi.fn(),
  loggerError: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  requirePermission: vi.fn(),
  setRequestLocale: vi.fn(),
  updateAdminUserAction: vi.fn(),
}));

function emailHistoryRowsWithFallback() {
  return [
    {
      bouncedAt: null,
      category: 'password_reset',
      complainedAt: null,
      createdAt: new Date('2026-05-01T12:00:00.000Z'),
      deliveredAt: null,
      failedAt: null,
      id: 'email-1',
      lastError: null,
      lastEventAt: new Date('2026-05-01T12:01:00.000Z'),
      lastEventType: 'email.delivered',
      newsletterBroadcastId: null,
      sentAt: new Date('2026-05-01T12:00:00.000Z'),
      subject: 'Reset your password',
      suppressedAt: null,
      toEmail: 'sailor@example.com',
    },
    {
      bouncedAt: null,
      category: 'custom',
      complainedAt: null,
      createdAt: new Date('2026-05-02T12:00:00.000Z'),
      deliveredAt: null,
      failedAt: null,
      id: 'email-2',
      lastError: 'smtp rejected',
      lastEventAt: null,
      lastEventType: null,
      newsletterBroadcastId: null,
      sentAt: null,
      subject: 'Custom notice',
      suppressedAt: null,
      toEmail: 'sailor@example.com',
    },
  ];
}

function eventPaymentHistoryRow(options: {
  readonly amountCents: number;
  readonly createdAt: string;
  readonly detailHref: string;
  readonly id: string;
  readonly receiptHref: string | null;
  readonly status: 'disputed' | 'paid';
  readonly title: string;
}) {
  return {
    amountCents: options.amountCents,
    amountPaidCents: null,
    cardType: null,
    cardYear: null,
    createdAt: new Date(options.createdAt),
    currency: 'usd',
    detailHref: options.detailHref,
    id: options.id,
    manualHandledAt: null,
    manualHandledByName: null,
    manualHandledNote: null,
    purpose: 'event',
    receiptHref: options.receiptHref,
    source: PaymentSource.stripe,
    status: options.status,
    stripeDiscountMetadata: null,
    title: options.title,
  };
}

function membershipPaymentHistoryRow() {
  return {
    amountCents: 12_000,
    amountPaidCents: null,
    cardType: SailingCardType.racing,
    cardYear: 2026,
    createdAt: new Date('2026-05-19T16:00:00.000Z'),
    currency: 'usd',
    detailHref: null,
    id: 'payment-3',
    manualHandledAt: new Date('2026-05-19T17:00:00.000Z'),
    manualHandledByName: 'Dock Master',
    manualHandledNote: 'Admin issued sailing card without payment.',
    purpose: 'membership',
    receiptHref: null,
    source: PaymentSource.legacy,
    status: 'paid',
    stripeDiscountMetadata: null,
    title: '',
  };
}

function paymentHistoryRowsWithSuccessfulAndFailedPayments() {
  return [
    eventPaymentHistoryRow({
      amountCents: 2500,
      createdAt: '2026-05-21T16:00:00.000Z',
      detailHref: '/events/firefly-clinic',
      id: 'payment-1',
      receiptHref: 'https://pay.stripe.com/receipts/payment-1',
      status: 'paid',
      title: 'Firefly Clinic',
    }),
    eventPaymentHistoryRow({
      amountCents: 1500,
      createdAt: '2026-05-20T16:00:00.000Z',
      detailHref: '/events/frostbite-regatta',
      id: 'payment-2',
      receiptHref: null,
      status: 'disputed',
      title: 'Frostbite Regatta',
    }),
    membershipPaymentHistoryRow(),
  ];
}

function mockUserPaymentHistoryRows(rows: readonly unknown[]) {
  mocks.listAdminUserPaymentHistory.mockResolvedValue(rows);
}

function mockUserMembershipAccessRows(rows: readonly unknown[]) {
  mocks.listAdminUserCurrentMembershipPaymentAccessHistory.mockResolvedValue(
    rows
  );
}

function mockUserPaymentRows(
  historyRows: readonly unknown[],
  accessRows: readonly unknown[] = historyRows
) {
  mockUserPaymentHistoryRows(historyRows);
  mockUserMembershipAccessRows(accessRows);
}

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/components/mit-sailing/admin/catalog/AdminCatalogForm', () => ({
  AdminCatalogForm: (props: { headingKey: string }) => (
    <form data-heading={props.headingKey} />
  ),
}));

vi.mock('@/components/mit-sailing/admin/AdminPageHeader', () => ({
  AdminPageHeader: (props: {
    actions?: React.ReactNode;
    title: React.ReactNode;
  }) => (
    <header>
      <h1>{props.title}</h1>
      {props.actions ? (
        <div data-testid="admin-actions">{props.actions}</div>
      ) : null}
    </header>
  ),
}));

vi.mock('@/components/mit-sailing/admin/AdminPrimaryActionLink', () => ({
  AdminPrimaryActionLink: (props: {
    children: React.ReactNode;
    href: string;
  }) => <a href={props.href}>{props.children}</a>,
}));

vi.mock('@/components/mit-sailing/admin/catalog/AdminCatalogTable', () => ({
  AdminCatalogTable: (props: {
    definition: {
      capabilities: {
        create: boolean;
        delete: boolean;
        reorder: boolean;
        update: boolean;
      };
    };
    filters?: readonly { field: string }[];
    rows: unknown[];
    search?: { fields: readonly string[] };
    userImpersonation?: unknown;
  }) => {
    const { capabilities } = props.definition;
    return (
      <div
        data-can-create={String(capabilities.create)}
        data-can-delete={String(capabilities.delete)}
        data-can-reorder={String(capabilities.reorder)}
        data-can-update={String(capabilities.update)}
        data-has-impersonation={String(Boolean(props.userImpersonation))}
        data-filter-fields={
          props.filters?.map((filter) => filter.field).join(',') ?? ''
        }
        data-row-count={props.rows.length}
        data-search-fields={props.search?.fields.join(',') ?? ''}
        data-testid="admin-catalog-table"
      />
    );
  },
}));

vi.mock('@/components/mit-sailing/admin/users/AdminUserRatingsPanel', () => ({
  AdminUserRatingsPanel: (props: { ratingsLoadFailed: boolean }) => (
    <section data-testid="ratings-panel">
      {props.ratingsLoadFailed ? 'ratings-load-failed' : 'ratings-loaded'}
    </section>
  ),
}));

vi.mock('@/components/mit-sailing/admin/cards/AdminSailingCardHistory', () => ({
  AdminSailingCardHistory: () => <section data-testid="card-history-panel" />,
}));

vi.mock(
  '@/components/mit-sailing/admin/cards/AdminSailingCardControls',
  () => ({
    AdminSailingCardHistory: () => <section data-testid="card-history-panel" />,
    AdminSailingCardExpireForm: () => <form aria-label="Expire sailing card" />,
    AdminSailingCardChangeNumberForm: (props: {
      currentCardNumber: number;
    }) => (
      <form
        aria-label="Change sailing card number"
        data-current-card-number={props.currentCardNumber}
      />
    ),
    AdminSailingCardIssueForm: (props: {
      cardType?: SailingCardType;
      needsRecreationVerification?: boolean;
      paymentAccess?: 'blocked' | 'none' | 'paid';
      suggestedCardNumber: number;
    }) => (
      <form
        aria-label="Issue sailing card"
        data-card-type={props.cardType}
        data-needs-recreation-verification={String(
          Boolean(props.needsRecreationVerification)
        )}
        data-payment-access={props.paymentAccess}
        data-suggested-card-number={props.suggestedCardNumber}
      />
    ),
    AdminSailingCardPrintActions: (props: { userId: string }) => (
      <div>
        <a href={`/admin/users/${props.userId}/sailing-card/print`}>
          Print card
        </a>
        <a href={`/admin/users/${props.userId}/sailing-card/quick-print`}>
          Quick print
        </a>
      </div>
    ),
  })
);

vi.mock('@/libs/admin/users/adminUserActions', () => ({
  createAdminUserAction: mocks.createAdminUserAction,
  deleteAdminUserAction: mocks.deleteAdminUserAction,
  updateAdminUserAction: mocks.updateAdminUserAction,
}));

vi.mock('@/libs/admin/cards/adminSailingCardUiQueries', () => ({
  getAdminSailingCardHistory: mocks.getAdminSailingCardHistory,
  getAdminUserSailingCardSummary: mocks.getAdminUserSailingCardSummary,
}));

vi.mock('@/libs/admin/cards/adminSailingCardQueries', () => ({
  getNextAvailableSailingCardNumber: mocks.getNextAvailableSailingCardNumber,
}));

vi.mock('@/libs/admin/users/usersAdminHandlers', () => ({
  ADMIN_USERS_PAGE_SIZE: 50,
  listAdminUsersPage: async (options: { page: number; pageSize: number }) => {
    const rows = await mocks.list(options);
    return {
      page: options.page,
      pageSize: options.pageSize,
      rows,
      total: rows.length,
    };
  },
  usersAdminHandlers: {
    getById: mocks.getById,
    list: mocks.list,
  },
}));

vi.mock('@/libs/admin/users/adminUserPaymentHistory', () => ({
  ADMIN_USER_PAYMENT_HISTORY_PAGE_SIZE: 25,
  listAdminUserCurrentMembershipPaymentAccessHistory:
    mocks.listAdminUserCurrentMembershipPaymentAccessHistory,
  listAdminUserPaymentHistoryPage: async (options: {
    page: number;
    pageSize: number;
    userId: string;
  }) => {
    const rows = await mocks.listAdminUserPaymentHistory(options.userId);
    return {
      page: options.page,
      pageSize: options.pageSize,
      rows,
      total: rows.length,
    };
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  appRoleFromSessionUser: (user: { appRole?: unknown }) => user.appRole,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  ADMIN_USER_EMAIL_MESSAGES_PAGE_SIZE: 25,
  getAdminUserEmailMessagesPage: async (options: {
    email: string;
    page: number;
    pageSize: number;
    userId: string;
  }) => {
    const rows = await mocks.getAdminUserEmailMessages(options);
    return {
      page: options.page,
      pageSize: options.pageSize,
      rows,
      total: rows.length,
    };
  },
}));

vi.mock('@/libs/Logger', () => ({
  logger: { error: mocks.loggerError },
}));

vi.mock('@/libs/mit-sailing/sailingRatingQueries', () => ({
  listUserRatingAssignmentRows: mocks.listUserRatingAssignmentRows,
}));

beforeEach(() => {
  vi.resetModules();
  mocks.createAdminUserAction.mockReset();
  mocks.deleteAdminUserAction.mockReset();
  mocks.getById.mockReset();
  mocks.getAdminUserEmailMessages.mockReset();
  mocks.getAdminSailingCardHistory.mockReset();
  mocks.getAdminUserSailingCardSummary.mockReset();
  mocks.getNextAvailableSailingCardNumber.mockReset();
  mocks.listAdminUserCurrentMembershipPaymentAccessHistory.mockReset();
  mocks.listAdminUserPaymentHistory.mockReset();
  mocks.getTranslations.mockClear();
  mocks.list.mockReset();
  mocks.listUserRatingAssignmentRows.mockReset();
  mocks.loggerError.mockReset();
  mocks.notFound.mockClear();
  mocks.requirePermission.mockReset();
  mocks.setRequestLocale.mockClear();
  mocks.updateAdminUserAction.mockReset();

  mocks.createAdminUserAction.mockReturnValue(async () => {});
  mocks.deleteAdminUserAction.mockReturnValue(async () => {});
  mocks.getById.mockResolvedValue({
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    email: 'sailor@example.com',
    emailDeliverabilityStatus: 'ok',
    emailSuppressionReason: null,
    emailVerified: true,
    emergencyContactName: 'Emergency One',
    emergencyContactPhone: '+15555550102',
    firstName: 'Sailor',
    id: 'user-1',
    lastName: 'One',
    mitClassYear: null,
    mitDataWarehouseVerifiedAt: null,
    mitId: '123456789',
    name: 'Sailor One',
    phone: '+15555550101',
    sailingAffiliation: 'OTHER_NON_STUDENT',
    sailingCardNumber: 61,
    appRole: 'user',
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
  mocks.getAdminUserEmailMessages.mockResolvedValue([]);
  mocks.getAdminSailingCardHistory.mockResolvedValue([]);
  mocks.getNextAvailableSailingCardNumber.mockResolvedValue(2471);
  mocks.getAdminUserSailingCardSummary.mockResolvedValue({
    legalAgreementAcceptances: [
      {
        acceptedAt: new Date('2026-06-01T16:00:00.000Z'),
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
      },
    ],
    gymMembershipVerifiedAt: null,
    sailingCardRequests: [],
    sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
    sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
    sailingCardIssuedBy: { name: 'Dock Master' },
    sailingCardNumber: 61,
    sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardSwimAgreementInitialedAt: new Date('2026-06-01T16:00:00.000Z'),
    sailingCardSwimAgreementInitials: 'AK',
    sailingCardYear: 2026,
  });
  mocks.list.mockResolvedValue([
    {
      email: 'sailor@example.com',
      emailBouncedAt: null,
      emailDeliverabilityStatus: 'ok',
      emailSuppressedAt: null,
      emailSuppressionReason: null,
      emailVerified: true,
      emergencyContactName: 'Emergency One',
      emergencyContactPhone: '+15555550102',
      firstName: 'Sailor',
      id: 'user-1',
      lastName: 'One',
      mitClassYear: null,
      mitDataWarehouseVerifiedAt: null,
      mitId: '123456789',
      name: 'Sailor One',
      phone: '+15555550101',
      sailingAffiliation: 'OTHER_NON_STUDENT',
      sailingCardNumber: 61,
      sailingCardStatus: 'current',
      appRole: 'user',
      banned: false,
    },
  ]);
  mockUserPaymentRows([]);
  mocks.listUserRatingAssignmentRows.mockResolvedValue([]);
  mocks.requirePermission.mockResolvedValue({
    session: { impersonatedBy: null },
    user: {
      appRole: 'admin',
      banned: false,
      emailVerified: true,
      id: 'admin-1',
      role: 'user',
    },
  });
  mocks.updateAdminUserAction.mockReturnValue(async () => {});
});

function pendingCardSummary() {
  return {
    legalAgreementAcceptances: [
      {
        acceptedAt: new Date('2026-06-01T16:00:00.000Z'),
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
      },
    ],
    gymMembershipVerifiedAt: null,
    sailingCardRequests: [
      {
        cardType: SailingCardType.normal,
        cardYear: 2026,
        hasFitnessMembership: true,
        issuedCardNumber: null,
        requestedAt: new Date('2026-05-21T16:00:00.000Z'),
        sailingAffiliation: SailingAffiliation.MIT_STUDENT,
        status: SailingCardRequestStatus.pending,
      },
    ],
    sailingCardExpiresOn: null,
    sailingCardIssuedAt: null,
    sailingCardIssuedBy: null,
    sailingCardNumber: null,
    sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardSwimAgreementInitialedAt: new Date('2026-06-01T16:00:00.000Z'),
    sailingCardSwimAgreementInitials: 'AK',
    sailingCardYear: null,
  };
}

function pendingRecreationVerificationCardSummary() {
  const summary = pendingCardSummary();

  return {
    ...summary,
    sailingCardRequests: [
      {
        ...summary.sailingCardRequests[0],
        sailingAffiliation: SailingAffiliation.MIT_ALUM,
      },
    ],
  };
}

function issuedRacingCardSummary() {
  return {
    ...pendingCardSummary(),
    sailingCardRequests: [
      {
        cardType: SailingCardType.racing,
        cardYear: 2026,
        hasFitnessMembership: true,
        issuedCardNumber: 61,
        requestedAt: new Date('2026-05-21T16:00:00.000Z'),
        sailingAffiliation: SailingAffiliation.OTHER_NON_STUDENT,
        status: SailingCardRequestStatus.approved,
      },
    ],
    sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
    sailingCardIssuedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardIssuedBy: { name: 'Dock Master' },
    sailingCardNumber: 61,
    sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardYear: 2026,
  };
}

describe('admin user pages', () => {
  it('keeps the user index behind the view-users permission', async () => {
    const { default: AdminUsersIndexPage } = await import('./page');

    await AdminUsersIndexPage({
      params: Promise.resolve({ locale: 'en' }),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_VIEW,
      'en'
    );
    expect(mocks.list).toHaveBeenCalledOnce();
  });

  it('keeps user creation behind the edit-users permission', async () => {
    const { default: AdminUsersNewPage } = await import('./new/page');

    await AdminUsersNewPage({
      params: Promise.resolve({ locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_EDIT,
      'en'
    );
  });

  it('keeps user edit behind the edit-users permission', async () => {
    const { default: AdminUsersEditPage } = await import('./[id]/edit/page');

    await AdminUsersEditPage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_EDIT,
      'en'
    );
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
  });

  it('keeps user deletion behind the delete-users permission', async () => {
    const { default: AdminUsersDeletePage } =
      await import('./[id]/delete/page');

    await AdminUsersDeletePage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_DELETE,
      'en'
    );
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
  });

  it('keeps the user detail page behind the view-users permission', async () => {
    mocks.requirePermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.DOCK_STAFF,
        banned: false,
        emailVerified: true,
        id: 'staff-1',
        role: Role.USER,
      },
    });
    const { default: AdminUserShowPage } = await import('./[id]/page');

    await AdminUserShowPage({
      params: Promise.resolve({ id: 'user-1', locale: 'en' }),
      searchParams: Promise.resolve({}),
    });

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requirePermission).toHaveBeenCalledWith(
      Permission.USERS_VIEW,
      'en'
    );
    expect(mocks.getById).toHaveBeenCalledWith('user-1');
    expect(mocks.listUserRatingAssignmentRows).toHaveBeenCalledWith('user-1');
  });

  it('shows the sailing-card panel without replacing ratings', async () => {
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('sailing_card_heading')).toBeInTheDocument();
    expect(screen.getByText('identity_name')).toBeInTheDocument();
    expect(screen.getByText('identity_affiliation')).toBeInTheDocument();
    expect(
      screen.getByText('affiliation_other_non_student')
    ).toBeInTheDocument();
    expect(screen.getByText('identity_source_manual')).toBeInTheDocument();
    expect(screen.getByText('identity_phone')).toBeInTheDocument();
    expect(screen.getByText('+15555550101')).toBeInTheDocument();
    expect(
      screen.getByText('identity_emergency_contact_name')
    ).toBeInTheDocument();
    expect(screen.getByText('Emergency One')).toBeInTheDocument();
    expect(
      screen.getByText('identity_emergency_contact_phone')
    ).toBeInTheDocument();
    expect(screen.getByText('+15555550102')).toBeInTheDocument();
    expect(screen.getByText('123456789')).toBeInTheDocument();
    expect(screen.getAllByText('61').length).toBeGreaterThan(0);
    expect(screen.getByText('2026')).toBeInTheDocument();
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
    expect(screen.getByTestId('card-history-panel')).toBeInTheDocument();
    expect(screen.getByTestId('ratings-panel')).toBeInTheDocument();
  });

  it('shows suggested issue number on the user detail page', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue(
      pendingCardSummary()
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByText('sailing_card_status_requested')
    ).toBeInTheDocument();
    expect(screen.getByText('sailing_card_number')).toBeInTheDocument();
    expect(
      screen.getByText('sailing_card_assignment_pending')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Issue sailing card' })
    ).toHaveAttribute('data-suggested-card-number', '2471');
    expect(mocks.getNextAvailableSailingCardNumber).toHaveBeenCalledWith({
      cardYear: 2026,
    });
  });

  it('passes recreation verification requirement to normal card issue form', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue(
      pendingRecreationVerificationCardSummary()
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('form', { name: 'Issue sailing card' })
    ).toHaveAttribute('data-needs-recreation-verification', 'true');
  });

  it('shows card number correction on the user detail page for issued cards', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue({
      legalAgreementAcceptances: [
        {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
        },
      ],
      sailingCardRequests: [],
      sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardIssuedBy: { name: 'Dock Master' },
      sailingCardNumber: 61,
      sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardSwimAgreementInitials: 'AK',
      sailingCardYear: 2026,
      gymMembershipVerifiedAt: null,
    });
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('form', { name: 'Change sailing card number' })
    ).toHaveAttribute('data-current-card-number', '61');
  });

  it('shows card print actions for current cards', async () => {
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByRole('link', { name: 'Print card' })).toHaveAttribute(
      'href',
      '/admin/users/user-1/sailing-card/print'
    );
    expect(screen.getByRole('link', { name: 'Quick print' })).toHaveAttribute(
      'href',
      '/admin/users/user-1/sailing-card/quick-print'
    );
  });

  it('does not show removed payment-bypass copy on the sailing-card panel', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue(
      issuedRacingCardSummary()
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.queryByText('sailing_card_payment_bypass_title')).toBeNull();
    expect(screen.queryByText('sailing_card_payment_bypass_body')).toBeNull();
  });

  it('does not fetch the next card number when no pending request can be issued', async () => {
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mocks.getNextAvailableSailingCardNumber).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('form', { name: 'Issue sailing card' })
    ).toBeNull();
  });

  it('keeps user detail available when sailing-card panel fails to load', async () => {
    mocks.getAdminSailingCardHistory.mockRejectedValue(
      new Error('audit failed')
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Sailor One' })
    ).toBeInTheDocument();
    expect(screen.getByText('sailing_card_load_failed')).toBeInTheDocument();
    expect(screen.getByTestId('ratings-panel')).toBeInTheDocument();
  });

  it('keeps user detail available when ratings fail to load', async () => {
    mocks.listUserRatingAssignmentRows.mockRejectedValue(
      new Error('ratings failed')
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Sailor One' })
    ).toBeInTheDocument();
    expect(screen.getByText('ratings-load-failed')).toBeInTheDocument();
    expect(screen.getByText('emails_heading')).toBeInTheDocument();
  });

  it('keeps user detail available when email history fails to load', async () => {
    mocks.getAdminUserEmailMessages.mockRejectedValue(
      new Error('email failed')
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('heading', { name: 'Sailor One' })
    ).toBeInTheDocument();
    expect(screen.getByText('emails_load_failed')).toBeInTheDocument();
    expect(screen.getByText('emails_empty')).toBeInTheDocument();
  });

  it('renders email history with category status date and error fallback', async () => {
    mocks.getAdminUserEmailMessages.mockResolvedValue(
      emailHistoryRowsWithFallback()
    );
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('Reset your password')).toBeInTheDocument();
    expect(
      screen.getByText('email_category_password_reset')
    ).toBeInTheDocument();
    expect(screen.getByText('email_event_delivered')).toBeInTheDocument();
    expect(screen.getAllByText('empty_value').length).toBeGreaterThan(0);
    expect(screen.getByText('Custom notice')).toBeInTheDocument();
    expect(screen.getByText('email_category_other')).toBeInTheDocument();
    expect(screen.getByText('email_event_unknown')).toBeInTheDocument();
    expect(screen.getByText('smtp rejected')).toBeInTheDocument();
  });

  it('renders user payment history with successful and failed payments', async () => {
    mockUserPaymentHistoryRows(
      paymentHistoryRowsWithSuccessfulAndFailedPayments()
    );
    mockUserMembershipAccessRows([membershipPaymentHistoryRow()]);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(mocks.listAdminUserPaymentHistory).toHaveBeenCalledWith('user-1');
    expect(screen.getByText('payments_heading')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Firefly Clinic' })
    ).toHaveAttribute('href', '/events/firefly-clinic');
    expect(screen.getByText('$25.00')).toBeInTheDocument();
    expect(screen.getAllByText('payment_status_paid')).toHaveLength(2);
    expect(screen.getByText('Frostbite Regatta')).toBeInTheDocument();
    expect(screen.getByText('payment_status_disputed')).toBeInTheDocument();
    expect(screen.getByText('payment_source_legacy')).toBeInTheDocument();
    expect(screen.getByText('payment_manual_meta')).toBeInTheDocument();
    expect(screen.getByText('payment_manual_note')).toBeInTheDocument();
    expect(screen.getByText('payment_title_membership')).toBeInTheDocument();
  });

  it('renders current payment blockers before detail sections', async () => {
    mockUserPaymentRows([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-3',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.stripe,
        status: 'disputed',
        title: '',
      },
    ]);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('current_blockers_heading')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'admin_user_blocker_payment_disputed',
      })
    ).toHaveAttribute('href', '#membership-payment-status');
  });

  it('uses the newest decisive current payment access across membership rows', async () => {
    mockUserPaymentRows([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-20T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-4',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.legacy,
        status: 'needs_review',
        title: '',
      },
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-3',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: 'https://pay.stripe.test/receipts/1',
        source: PaymentSource.stripe,
        status: 'paid',
        title: '',
      },
    ]);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('link', {
        name: 'admin_user_blocker_legacy_review',
      })
    ).toHaveAttribute('href', '#membership-payment-status');
  });

  it('keeps payment blockers when a disputed membership payment remains', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue(
      issuedRacingCardSummary()
    );
    mockUserPaymentRows([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-3',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.stripe,
        status: 'disputed',
        title: '',
      },
    ]);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(screen.getByText('current_blockers_heading')).toBeInTheDocument();
    expect(
      screen.getByRole('link', {
        name: 'admin_user_blocker_payment_disputed',
      })
    ).toHaveAttribute('href', '#membership-payment-status');
  });

  it('keeps current payment blockers when newer pending rows exist', async () => {
    mockUserPaymentRows([
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-20T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-4',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.stripe,
        status: 'checkout_created',
        title: '',
      },
      {
        amountCents: 12_000,
        cardType: SailingCardType.racing,
        cardYear: 2026,
        createdAt: new Date('2026-05-19T16:00:00.000Z'),
        currency: 'usd',
        detailHref: null,
        id: 'payment-3',
        manualHandledAt: null,
        manualHandledByName: null,
        manualHandledNote: null,
        purpose: 'membership',
        receiptHref: null,
        source: PaymentSource.stripe,
        status: 'past_due',
        title: '',
      },
    ]);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('link', {
        name: 'admin_user_blocker_payment_past_due',
      })
    ).toHaveAttribute('href', '#membership-payment-status');
  });

  it('returns not found when the user no longer exists', async () => {
    mocks.getById.mockResolvedValue(null);
    const { default: AdminUserShowPage } = await import('./[id]/page');

    await expect(
      AdminUserShowPage({
        params: Promise.resolve({ id: 'missing-user', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.getAdminUserSailingCardSummary).not.toHaveBeenCalled();
    expect(mocks.listUserRatingAssignmentRows).not.toHaveBeenCalled();
  });

  it('shows an expire action for current cards when the admin can expire cards', async () => {
    mocks.getAdminUserSailingCardSummary.mockResolvedValue({
      legalAgreementAcceptances: [
        {
          acceptedAt: new Date('2026-05-21T16:00:00.000Z'),
          agreementHash: sailingCardAgreementHash(),
          agreementVersion: sailingCardAgreement.version,
        },
      ],
      sailingCardRequests: [],
      sailingCardExpiresOn: new Date('2026-07-15T04:00:00.000Z'),
      sailingCardIssuedAt: new Date('2025-08-01T16:00:00.000Z'),
      sailingCardIssuedBy: { name: 'Dock Master' },
      sailingCardNumber: 61,
      sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardSwimAgreementInitialedAt: new Date('2026-05-21T16:00:00.000Z'),
      sailingCardSwimAgreementInitials: 'AK',
      sailingCardYear: 2026,
    });
    const { default: AdminUserShowPage } = await import('./[id]/page');

    render(
      await AdminUserShowPage({
        params: Promise.resolve({ id: 'user-1', locale: 'en' }),
        searchParams: Promise.resolve({}),
      })
    );

    expect(
      screen.getByRole('form', { name: 'Expire sailing card' })
    ).toBeInTheDocument();
  });

  it('passes edit and delete capabilities for admin users', async () => {
    const { default: AdminUsersIndexPage } = await import('./page');

    render(
      await AdminUsersIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByRole('link', { name: 'action_create' })).toHaveAttribute(
      'href',
      '/admin/users/new'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-create',
      'true'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-update',
      'true'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-delete',
      'true'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-reorder',
      'false'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-has-impersonation',
      'true'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-search-fields',
      ''
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-filter-fields',
      ''
    );
  });

  it('omits edit and delete capabilities for staff users', async () => {
    mocks.requirePermission.mockResolvedValue({
      session: { impersonatedBy: null },
      user: {
        appRole: Role.DOCK_STAFF,
        banned: false,
        emailVerified: true,
        id: 'staff-1',
        role: Role.USER,
      },
    });
    const { default: AdminUsersIndexPage } = await import('./page');

    render(
      await AdminUsersIndexPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(
      screen.queryByRole('link', { name: 'action_create' })
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-create',
      'false'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-update',
      'false'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-can-delete',
      'false'
    );
    expect(screen.getByTestId('admin-catalog-table')).toHaveAttribute(
      'data-has-impersonation',
      'false'
    );
  });
});
