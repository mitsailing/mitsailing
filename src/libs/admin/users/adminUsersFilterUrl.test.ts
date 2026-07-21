import { describe, expect, it } from 'vitest';
import { adminUsersFilterChips } from './adminUsersFilterUrl';

const chipLabels = {
  cardTypeLabel: 'Pending card type',
  cardTypeNormal: 'Normal',
  cardTypeRacing: 'Racing',
  cardTypeTeamRacing: 'Team racing',
  chipRemoveAria: (label: string) => `Remove ${label} filter`,
  emailStatusBounced: 'Bounced',
  emailStatusLabel: 'Email status',
  emailStatusOk: 'OK',
  emailStatusSuppressed: 'Suppressed',
  sailingCardStatusCurrent: 'Current',
  sailingCardStatusExpired: 'Expired',
  sailingCardStatusLabel: 'Sailing card status',
  sailingCardStatusNone: 'None',
  sailingCardStatusPending: 'Pending',
  searchLabel: 'Search users',
};

describe('adminUsersFilterChips', () => {
  it('builds chip with remove href when email status is filtered', () => {
    const chips = adminUsersFilterChips(
      {
        cardType: 'all',
        emailStatus: 'bounced',
        query: '',
        sailingCardStatus: 'all',
      },
      chipLabels
    );

    expect(chips).toHaveLength(1);
    expect(chips[0]).toMatchObject({
      key: 'emailStatus',
      label: 'Email status',
      removeHref: '/admin/users',
      valueLabel: 'Bounced',
    });
  });

  it('builds search chip that clears query only', () => {
    const chips = adminUsersFilterChips(
      {
        cardType: 'all',
        emailStatus: 'all',
        query: 'ada',
        sailingCardStatus: 'all',
      },
      chipLabels
    );

    expect(chips[0]?.removeHref).toBe('/admin/users');
    expect(chips[0]?.valueLabel).toBe('ada');
  });
});
