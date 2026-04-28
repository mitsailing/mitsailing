import { adminClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/**
 * Better Auth React client. The `adminClient` plugin mirrors the server's
 * admin plugin so `authClient.admin.*` helpers are type-safe without a
 * manual declaration. Server-only error codes translate via the `@better-auth/i18n`
 * plugin registered on the server instance.
 */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
