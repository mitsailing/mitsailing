import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    rows: unknown[];
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
        data-row-count={props.rows.length}
        data-testid="admin-catalog-table"
      />
    );
  },
}));

vi.mock('@/components/mit-sailing/admin/users/AdminUserRatingsPanel', () => ({
  AdminUserRatingsPanel: () => <section data-testid="ratings-panel" />,
}));

vi.mock('@/components/mit-sailing/admin/cards/AdminSailingCardHistory', () => ({
  AdminSailingCardHistory: () => <section data-testid="card-history-panel" />,
}));

vi.mock('@/components/mit-sailing/admin/cards/AdminSailingCardQueue', () => ({
  AdminSailingCardHistory: () => <section data-testid="card-history-panel" />,
  AdminSailingCardExpireForm: () => <form aria-label="Expire sailing card" />,
}));

vi.mock('@/libs/admin/users/adminUserActions', () => ({
  createAdminUserAction: mocks.createAdminUserAction,
  deleteAdminUserAction: mocks.deleteAdminUserAction,
  updateAdminUserAction: mocks.updateAdminUserAction,
}));

vi.mock('@/libs/admin/cards/adminSailingCardUiQueries', () => ({
  getAdminSailingCardHistory: mocks.getAdminSailingCardHistory,
  getAdminUserSailingCardSummary: mocks.getAdminUserSailingCardSummary,
}));

vi.mock('@/libs/admin/users/usersAdminHandlers', () => ({
  usersAdminHandlers: {
    getById: mocks.getById,
    list: mocks.list,
  },
}));

vi.mock('@/libs/auth/dal', () => ({
  appRoleFromSessionUser: (user: { appRole?: unknown }) => user.appRole,
  requirePermission: mocks.requirePermission,
}));

vi.mock('@/libs/email/emailMessages', () => ({
  getAdminUserEmailMessages: mocks.getAdminUserEmailMessages,
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
    id: 'user-1',
    name: 'Sailor One',
    appRole: 'user',
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  });
  mocks.getAdminUserEmailMessages.mockResolvedValue([]);
  mocks.getAdminSailingCardHistory.mockResolvedValue([]);
  mocks.getAdminUserSailingCardSummary.mockResolvedValue({
    legalAgreementAcceptances: [
      {
        acceptedAt: new Date('2026-06-01T16:00:00.000Z'),
        agreementHash: sailingCardAgreementHash(),
        agreementVersion: sailingCardAgreement.version,
      },
    ],
    sailingCardExpiresOn: new Date('2027-07-15T04:00:00.000Z'),
    sailingCardIssuedAt: new Date('2026-08-01T16:00:00.000Z'),
    sailingCardIssuedBy: { name: 'Dock Master' },
    sailingCardNumber: 61,
    sailingCardRequestedAt: new Date('2026-05-21T16:00:00.000Z'),
    sailingCardSwimAgreementInitialedAt: new Date('2026-06-01T16:00:00.000Z'),
    sailingCardSwimAgreementInitials: 'AK',
    sailingCardYear: 2027,
  });
  mocks.list.mockResolvedValue([
    { email: 'sailor@example.com', id: 'user-1', name: 'Sailor One' },
  ]);
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
    expect(screen.getByText('61')).toBeInTheDocument();
    expect(screen.getByText('2027')).toBeInTheDocument();
    expect(screen.getByText(/Jun 1, 2026/)).toBeInTheDocument();
    expect(screen.getByTestId('card-history-panel')).toBeInTheDocument();
    expect(screen.getByTestId('ratings-panel')).toBeInTheDocument();
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

    expect(screen.getByText('Sailor One')).toBeInTheDocument();
    expect(screen.getByText('sailing_card_load_failed')).toBeInTheDocument();
    expect(screen.getByTestId('ratings-panel')).toBeInTheDocument();
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
