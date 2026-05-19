import 'server-only';
import { Role } from '@/libs/auth/roles';
import type { AppAuthContext } from '@/libs/zenstack/authContext';

type EventAccessRecord = {
  admins: readonly {
    adminUserId: string;
  }[];
};

const EVENT_MANAGER_ROLES = new Set<AppAuthContext['appRole']>([
  Role.ADMIN,
  Role.DOCK_STAFF,
  Role.DOCK_MASTER,
]);

export function canUpdateEventWithAuthContext(props: {
  authContext: AppAuthContext;
  event: EventAccessRecord;
}): boolean {
  if (EVENT_MANAGER_ROLES.has(props.authContext.appRole)) {
    return true;
  }
  return props.event.admins.some(
    (admin) => admin.adminUserId === props.authContext.id
  );
}
