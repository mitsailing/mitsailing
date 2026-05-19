import 'server-only';
import { Role } from '@/libs/auth/roles';
import type { AppAuthContext } from '@/libs/zenstack/authContext';

export type AdminEventAccessMode = 'editable' | 'readOnly';

export type EventAccessRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
};

const EVENT_MANAGER_ROLES = new Set<AppAuthContext['appRole']>([
  Role.ADMIN,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
]);

export function canManageAllEventsWithAuthContext(props: {
  authContext: AppAuthContext;
}): boolean {
  return EVENT_MANAGER_ROLES.has(props.authContext.appRole);
}

export function eventAccessModeWithAuthContext(props: {
  authContext: AppAuthContext;
  event: EventAccessRecord;
}): AdminEventAccessMode | null {
  if (canManageAllEventsWithAuthContext({ authContext: props.authContext })) {
    return 'editable';
  }
  if (
    props.event.admins.some(
      (admin) => admin.adminUserId === props.authContext.id
    )
  ) {
    return 'editable';
  }
  if (props.authContext.appRole === Role.VOLUNTEER_INSTRUCTOR) {
    return 'readOnly';
  }
  return null;
}

export function canUpdateEventWithAuthContext(props: {
  authContext: AppAuthContext;
  event: EventAccessRecord;
}): boolean {
  return (
    eventAccessModeWithAuthContext({
      authContext: props.authContext,
      event: props.event,
    }) === 'editable'
  );
}
