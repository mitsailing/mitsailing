import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserRatingAssignmentRow } from '@/libs/mit-sailing/sailingRatingQueries';

const mocks = vi.hoisted(() => ({
  getFormatter: vi.fn(async () => {
    await Promise.resolve();
    return {
      dateTime: (date: Date) => date.toISOString().slice(0, 10),
    };
  }),
  getTranslations: vi.fn(async () => {
    await Promise.resolve();
    return (key: string) => key;
  }),
  grantAdminUserRatingAction: vi.fn(),
  revokeAdminUserRatingAction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('next-intl/server', () => ({
  getFormatter: mocks.getFormatter,
  getTranslations: mocks.getTranslations,
}));

vi.mock('@/libs/admin/users/adminUserRatingActions', () => ({
  grantAdminUserRatingAction: mocks.grantAdminUserRatingAction,
  revokeAdminUserRatingAction: mocks.revokeAdminUserRatingAction,
}));

function ratingRow(
  props: Pick<UserRatingAssignmentRow, 'id'> &
    Partial<Omit<UserRatingAssignmentRow, 'id'>>
): UserRatingAssignmentRow {
  const { id, ...overrides } = props;
  return {
    category: null,
    description: `${id} description`,
    eligibility: { eligible: true },
    grantableClasses: [],
    guideUrl: null,
    id,
    isDeprecated: false,
    issuedAt: null,
    issuedByName: null,
    level: null,
    name: props.id,
    shortName: null,
    slug: id,
    unlockedBoats: [],
    windCondition: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.resetModules();
  mocks.getFormatter.mockClear();
  mocks.getTranslations.mockClear();
  mocks.grantAdminUserRatingAction.mockReset();
  mocks.revokeAdminUserRatingAction.mockReset();
});

describe('AdminUserRatingsPanel', () => {
  it('renders grant, revoke, and no-action states from rating assignment rows', async () => {
    const { AdminUserRatingsPanel } = await import('./AdminUserRatingsPanel');

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        locale: 'en',
        rows: [
          ratingRow({ id: 'crew', name: 'Crew' }),
          ratingRow({
            id: 'tech',
            issuedAt: new Date('2026-03-01T00:00:00.000Z'),
            issuedByName: 'Dock Master',
            name: 'Tech',
          }),
        ],
        userId: 'user-1',
      })
    );

    expect(
      screen.getByRole('button', { name: 'rating_action_grant' })
    ).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'rating_action_revoke' })
    ).toBeEnabled();
    expect(screen.getByText('2026-03-01')).toBeInTheDocument();
    expect(screen.getByText('Dock Master')).toBeInTheDocument();

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: false,
        locale: 'en',
        rows: [ratingRow({ id: 'harbor', name: 'Harbor' })],
        userId: 'user-1',
      })
    );

    const harborRow = screen.getByRole('row', { name: /Harbor/i });
    expect(
      within(harborRow).queryByRole('button', { name: 'rating_action_grant' })
    ).not.toBeInTheDocument();
  });

  it('explains disabled grant buttons for missing prerequisites and deprecated ratings', async () => {
    const { AdminUserRatingsPanel } = await import('./AdminUserRatingsPanel');

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        locale: 'en',
        rows: [
          ratingRow({
            eligibility: {
              eligible: false,
              missingRatingIds: ['crew'],
              reason: 'missing_prerequisites',
            },
            id: 'tech',
            name: 'Tech',
          }),
          ratingRow({
            eligibility: { eligible: false, reason: 'deprecated' },
            id: 'old',
            isDeprecated: true,
            name: 'Old rating',
          }),
          ratingRow({
            eligibility: { eligible: false, reason: 'already_granted' },
            id: 'crew',
            name: 'Crew',
          }),
        ],
        userId: 'user-1',
      })
    );

    const buttons = screen.getAllByRole('button', {
      name: 'rating_action_grant',
    });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[0]).toHaveAccessibleDescription(
      'rating_grant_disabled_missing_prerequisites'
    );
    expect(buttons[1]).toBeDisabled();
    expect(buttons[1]).toHaveAccessibleDescription(
      'rating_grant_disabled_deprecated'
    );
    expect(buttons[2]).toBeDisabled();
    expect(buttons[2]).toHaveAccessibleDescription(
      'rating_grant_disabled_already_granted'
    );
    expect(screen.getByText('rating_status_deprecated')).toBeInTheDocument();
  });

  it('renders rating alert messages for load failures and action error codes', async () => {
    const { AdminUserRatingsPanel } = await import('./AdminUserRatingsPanel');

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        errorCode: 'missing_prerequisites',
        locale: 'en',
        ratingsLoadFailed: false,
        rows: [],
        userId: 'user-1',
      })
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'rating_error_missing_prerequisites'
    );

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        errorCode: 'already_granted',
        locale: 'en',
        rows: [],
        userId: 'user-1',
      })
    );
    expect(
      screen.getByText('rating_error_already_granted')
    ).toBeInTheDocument();

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        errorCode: 'deprecated',
        locale: 'en',
        rows: [],
        userId: 'user-1',
      })
    );
    expect(screen.getByText('rating_error_deprecated')).toBeInTheDocument();

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        errorCode: 'unexpected',
        locale: 'en',
        rows: [],
        userId: 'user-1',
      })
    );
    expect(screen.getByText('rating_error_unknown')).toBeInTheDocument();

    render(
      await AdminUserRatingsPanel({
        canAssignRatings: true,
        errorCode: 'already_granted',
        locale: 'en',
        ratingsLoadFailed: true,
        rows: [],
        userId: 'user-1',
      })
    );
    expect(screen.getByText('rating_load_failed')).toBeInTheDocument();
  });
});
