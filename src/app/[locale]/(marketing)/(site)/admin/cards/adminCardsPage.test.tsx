import { render, screen } from '@testing-library/react';
import type * as React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sailingCardReviewPermissions } from '@/libs/admin/cards/adminSailingCardPermissions';
import { Role } from '@/libs/auth/roles';

const mocks = vi.hoisted(() => ({
  getNextAvailableSailingCardNumber: vi.fn(),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  listPendingSailingCardRequests: vi.fn(),
  requireAnyPermission: vi.fn(),
  setRequestLocale: vi.fn(),
}));

vi.mock('next-intl/server', () => ({
  getTranslations: mocks.getTranslations,
  setRequestLocale: mocks.setRequestLocale,
}));

vi.mock('@/components/mit-sailing/admin/AdminPageHeader', () => ({
  AdminPageHeader: (props: { title: React.ReactNode }) => (
    <header>
      <h1>{props.title}</h1>
    </header>
  ),
}));

vi.mock('@/components/mit-sailing/admin/cards/AdminSailingCardQueue', () => ({
  AdminSailingCardQueue: (props: {
    canAssignCards: boolean;
    locale: string;
    rows: readonly unknown[];
    suggestedCardNumber: number;
  }) => (
    <section
      data-can-assign-cards={String(props.canAssignCards)}
      data-locale={props.locale}
      data-row-count={props.rows.length}
      data-suggested-card-number={String(props.suggestedCardNumber)}
      data-testid="sailing-card-queue"
    />
  ),
}));

vi.mock('@/libs/admin/cards/adminSailingCardQueries', () => ({
  getNextAvailableSailingCardNumber: mocks.getNextAvailableSailingCardNumber,
}));

vi.mock('@/libs/admin/cards/adminSailingCardUiQueries', () => ({
  listPendingSailingCardRequests: mocks.listPendingSailingCardRequests,
}));

vi.mock('@/libs/auth/dal', () => ({
  appRoleFromSessionUser: (user: { appRole?: unknown }) => user.appRole,
  requireAnyPermission: mocks.requireAnyPermission,
}));

beforeEach(() => {
  vi.resetModules();
  vi.setSystemTime(new Date('2026-08-01T12:00:00-04:00'));
  mocks.getNextAvailableSailingCardNumber.mockReset();
  mocks.getTranslations.mockClear();
  mocks.listPendingSailingCardRequests.mockReset();
  mocks.requireAnyPermission.mockReset();
  mocks.setRequestLocale.mockClear();

  mocks.getNextAvailableSailingCardNumber.mockResolvedValue(61);
  mocks.listPendingSailingCardRequests.mockResolvedValue([
    { id: 'request-user-1' },
  ]);
  mocks.requireAnyPermission.mockResolvedValue({
    user: { appRole: Role.DOCK_STAFF, id: 'staff-1' },
  });
});

describe('admin cards page', () => {
  it('loads the sailing-card queue behind review permissions', async () => {
    const { default: AdminCardsPage } = await import('./page');

    render(
      await AdminCardsPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(mocks.setRequestLocale).toHaveBeenCalledWith('en');
    expect(mocks.requireAnyPermission).toHaveBeenCalledWith(
      sailingCardReviewPermissions,
      'en'
    );
    expect(mocks.listPendingSailingCardRequests).toHaveBeenCalledOnce();
    expect(mocks.getNextAvailableSailingCardNumber).toHaveBeenCalledWith({
      cardYear: 2027,
    });
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByTestId('sailing-card-queue')).toHaveAttribute(
      'data-can-assign-cards',
      'true'
    );
    expect(screen.getByTestId('sailing-card-queue')).toHaveAttribute(
      'data-row-count',
      '1'
    );
    expect(screen.getByTestId('sailing-card-queue')).toHaveAttribute(
      'data-suggested-card-number',
      '61'
    );
  });

  it('shows the queue without issue capability for review-only admins', async () => {
    mocks.requireAnyPermission.mockResolvedValue({
      user: { appRole: Role.VOLUNTEER_INSTRUCTOR, id: 'reviewer-1' },
    });
    const { default: AdminCardsPage } = await import('./page');

    render(
      await AdminCardsPage({
        params: Promise.resolve({ locale: 'en' }),
      })
    );

    expect(screen.getByTestId('sailing-card-queue')).toHaveAttribute(
      'data-can-assign-cards',
      'false'
    );
  });

  it('uses translated metadata for admin cards', async () => {
    const { generateMetadata } = await import('./page');

    await expect(
      generateMetadata({ params: Promise.resolve({ locale: 'en' }) })
    ).resolves.toEqual({ title: 'meta_title' });

    expect(mocks.getTranslations).toHaveBeenCalledWith({
      locale: 'en',
      namespace: 'AdminCards',
    });
  });
});
