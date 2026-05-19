import { describe, expect, it, vi } from 'vitest';
import { canUpdateEventWithAuthContext } from '@/libs/admin/events/zenstackEventAccess';
import { Role } from '@/libs/auth/roles';

vi.mock('server-only', () => ({}));

const unassignedEvent = {
  admins: [],
};

const assignedEvent = {
  admins: [{ adminUserId: 'instructor-1' }],
};

describe('canUpdateEventWithAuthContext', () => {
  it.each([Role.ADMIN, Role.DOCK_STAFF, Role.DOCK_MASTER])(
    'allows %s to update any event',
    (appRole) => {
      expect(
        canUpdateEventWithAuthContext({
          authContext: { appRole, id: 'staff-1' },
          event: unassignedEvent,
        })
      ).toBe(true);
    }
  );

  it('allows assigned event admins to update their event', () => {
    expect(
      canUpdateEventWithAuthContext({
        authContext: {
          appRole: Role.VOLUNTEER_INSTRUCTOR,
          id: 'instructor-1',
        },
        event: assignedEvent,
      })
    ).toBe(true);
  });

  it.each([Role.USER, Role.VOLUNTEER, Role.VOLUNTEER_INSTRUCTOR])(
    'blocks unassigned %s from updating events',
    (appRole) => {
      expect(
        canUpdateEventWithAuthContext({
          authContext: { appRole, id: 'sailor-1' },
          event: unassignedEvent,
        })
      ).toBe(false);
    }
  );
});
