import { Env } from '@/libs/Env';

/** Defaults aligned with `.env.example` and `tests/helpers/e2e-admin-sign-in.ts`. */
export const devAuthDefaultEmail = 'admin@example.com';
const devAuthDefaultParts = ['dev', 'local', 'change', 'me'] as const;
export const devAuthDefaultPassword = devAuthDefaultParts.join('-');

/**
 * True only on solo local `npm run dev` — never staging/production and never
 * while the Playwright e2e server is running (those specs must exercise `/login`
 * and sign-up UI).
 *
 * @returns Whether `GET /api/dev-login` may run.
 */
export function isDevAuthShortcutEnabled(): boolean {
  if (Env.APP_ENV === 'production' || Env.APP_ENV === 'staging') {
    return false;
  }
  if (Env.IS_E2E === '1') {
    return false;
  }
  return Env.APP_ENV === 'local';
}
