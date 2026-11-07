import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Role } from '@/libs/auth/roles';
import {
  buildLegacyMemberPaymentMap,
  loadLegacyUserIdentityMaps,
} from '@/libs/legacy-sync/legacyMemberIdentity';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

function member(overrides: Partial<LegacyMemberRow> = {}): LegacyMemberRow {
  return {
    active: '1',
    card: '42',
    email: 'sailor@example.com',
    emer_email: null,
    emer_name: null,
    emer_phone: null,
    expire_date: '2026-07-15',
    first: 'Sam',
    id: '123456789',
    last: 'Sailor',
    memb_type: null,
    phone: null,
    record: '1',
    record_date: '2026-01-01 09:00:00',
    status_type: null,
    username: 'sailor',
    ...overrides,
  };
}

describe('buildLegacyMemberPaymentMap', () => {
  it('maps active duplicate legacy ids to one canonical app user', () => {
    const map = buildLegacyMemberPaymentMap([
      member({ id: '123456789', username: 'sailor' }),
      member({
        card: '44',
        email: ' alternate@example.com ',
        expire_date: '2026-07-15',
        first: 'Other',
        id: '123456789',
        record_date: '2026-03-01 09:00:00',
        username: 'old-sailor',
      }),
      member({
        active: '0',
        email: 'inactive@example.com',
        id: '999999999',
        username: 'inactive',
      }),
    ]);

    expect(map.canonicalUsers).toHaveLength(1);
    expect(map.memberUserKeyByLegacyId.get('123456789')).toBe(
      map.memberUserKeyByEmail.get('alternate@example.com')
    );
    expect(map.memberUserKeyByUsername.get('old-sailor')).toBe(
      map.memberUserKeyByLegacyId.get('123456789')
    );
    expect(map.memberUserKeyByLegacyId.has('999999999')).toBe(false);
  });

  it('merges different active legacy ids that share the same email', () => {
    const map = buildLegacyMemberPaymentMap([
      member({
        email: 'shared@example.com',
        first: 'Older',
        id: '111111111',
        record_date: '2020-01-01 09:00:00',
        username: 'older-account',
      }),
      member({
        email: 'shared@example.com',
        first: 'Newer',
        id: '222222222',
        record_date: '2026-03-01 09:00:00',
        username: 'newer-account',
      }),
    ]);

    expect(map.canonicalUsers).toHaveLength(1);
    expect(map.canonicalUsers.at(0)).toMatchObject({
      email: 'shared@example.com',
      firstName: 'Newer',
      legacyMemberIds: expect.arrayContaining(['111111111', '222222222']),
    });
    expect(map.memberUserKeyByLegacyId.get('111111111')).toBe(
      map.memberUserKeyByLegacyId.get('222222222')
    );
    expect(map.memberUserKeyByUsername.get('older-account')).toBe(
      map.memberUserKeyByUsername.get('newer-account')
    );
  });

  it('maps explicit volunteer and dock staff categories to app roles', () => {
    const map = buildLegacyMemberPaymentMap([
      member({ email: 'volunteer@example.com', memb_type: '4' }),
      member({
        email: 'exec@example.com',
        id: '111111111',
        memb_type: '5',
        username: 'exec',
      }),
      member({
        email: 'instructor@example.com',
        id: '222222222',
        memb_type: '12',
        username: 'instructor',
      }),
      member({
        email: 'dockstaff@example.com',
        id: '333333333',
        memb_type: '6',
        username: 'dockstaff',
      }),
      member({
        email: 'dockmaster@example.com',
        id: '444444444',
        memb_type: '7',
        username: 'dockmaster',
      }),
      member({
        email: 'admin@example.com',
        id: '555555555',
        memb_type: '9',
        username: 'admin',
      }),
      member({
        email: 'sailing-team@example.com',
        id: '666666666',
        memb_type: '10',
        username: 'sailing-team',
      }),
    ]);

    expect(map.canonicalUsers.map((user) => [user.email, user.role])).toEqual([
      ['volunteer@example.com', Role.VOLUNTEER],
      ['exec@example.com', Role.VOLUNTEER_INSTRUCTOR],
      ['instructor@example.com', Role.VOLUNTEER_INSTRUCTOR],
      ['dockstaff@example.com', Role.DOCK_STAFF],
      ['dockmaster@example.com', Role.DOCK_MASTER],
      ['admin@example.com', Role.ADMIN],
      ['sailing-team@example.com', Role.USER],
    ]);
  });
});

describe('loadLegacyUserIdentityMaps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.queryRaw.mockResolvedValue([]);
  });

  it('maps every merged legacy member id to the same app user id', async () => {
    mocks.queryRaw.mockResolvedValue([
      { email: 'Shared@Example.com', id: 'app-user-shared' },
    ]);

    const maps = await loadLegacyUserIdentityMaps({
      db: { $queryRaw: mocks.queryRaw },
      members: [
        member({
          email: 'shared@example.com',
          id: '111111111',
          username: 'legacy-one',
        }),
        member({
          email: 'shared@example.com',
          id: '222222222',
          username: 'legacy-two',
        }),
      ],
    });

    expect(maps.legacyMemberIdToUserId.get('111111111')).toBe(
      'app-user-shared'
    );
    expect(maps.legacyMemberIdToUserId.get('222222222')).toBe(
      'app-user-shared'
    );
    expect(maps.usernameToUserId.get('legacy-one')).toBe('app-user-shared');
    expect(maps.usernameToUserId.get('legacy-two')).toBe('app-user-shared');
  });
});
