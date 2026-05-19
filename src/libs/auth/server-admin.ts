import 'server-only';
import { auth } from '@/libs/auth';
import type { Role } from '@/libs/auth/roles';

export async function setBetterAuthRoleMirror(props: {
  requestHeaders: Headers;
  role: Role;
  userId: string;
}): Promise<void> {
  await auth.api.setRole({
    body: {
      role: props.role,
      userId: props.userId,
    },
    headers: props.requestHeaders,
  });
}
