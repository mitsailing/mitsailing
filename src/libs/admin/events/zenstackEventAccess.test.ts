import { describe, expect, it, vi } from 'vitest';
import {
  canManageAllEventsWithAuthContext,
  canUpdateEventWithAuthContext,
  eventAccessModeWithAuthContext,
} from '@/libs/admin/events/zenstackEventAccess';
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

describe('canManageAllEventsWithAuthContext', () => {
  it.each([Role.ADMIN, Role.DOCK_STAFF, Role.DOCK_MASTER])(
    'allows %s to manage all events',
    (appRole) => {
      expect(
        canManageAllEventsWithAuthContext({
          authContext: { appRole, id: 'staff-1' },
        })
      ).toBe(true);
    }
  );

  it.each([Role.USER, Role.VOLUNTEER, Role.VOLUNTEER_INSTRUCTOR])(
    'blocks %s from managing all events',
    (appRole) => {
      expect(
        canManageAllEventsWithAuthContext({
          authContext: { appRole, id: 'sailor-1' },
        })
      ).toBe(false);
    }
  );
});

describe('eventAccessModeWithAuthContext', () => {
  it.each([Role.ADMIN, Role.DOCK_STAFF, Role.DOCK_MASTER])(
    'returns editable for global %s managers',
    (appRole) => {
      expect(
        eventAccessModeWithAuthContext({
          authContext: { appRole, id: 'staff-1' },
          event: unassignedEvent,
        })
      ).toBe('editable');
    }
  );

  it('returns editable for assigned volunteer instructors', () => {
    expect(
      eventAccessModeWithAuthContext({
        authContext: {
          appRole: Role.VOLUNTEER_INSTRUCTOR,
          id: 'instructor-1',
        },
        event: assignedEvent,
      })
    ).toBe('editable');
  });

  it('returns read-only for unassigned volunteer instructors', () => {
    expect(
      eventAccessModeWithAuthContext({
        authContext: {
          appRole: Role.VOLUNTEER_INSTRUCTOR,
          id: 'instructor-2',
        },
        event: assignedEvent,
      })
    ).toBe('readOnly');
  });

  it.each([Role.USER, Role.VOLUNTEER])(
    'returns null for unassigned %s users',
    (appRole) => {
      expect(
        eventAccessModeWithAuthContext({
          authContext: { appRole, id: 'sailor-1' },
          event: unassignedEvent,
        })
      ).toBeNull();
    }
  );
});
