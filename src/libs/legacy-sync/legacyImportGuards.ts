import { Env } from '@/libs/Env';

/**
 * Blocks legacy imports against remote databases during local development.
 *
 * @param env - App env and database URL to validate
 */
export function assertLocalDevDatabaseForLegacyImport(
  env: Pick<typeof Env, 'APP_ENV' | 'DATABASE_URL'> = Env
): void {
  if (env.APP_ENV === 'production') {
    return;
  }
  const databaseUrl = env.DATABASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error(
      'Legacy import aborted: DATABASE_URL must be a valid URL pointing at local dev_db.'
    );
  }
  const host = parsed.hostname;
  const databaseName = parsed.pathname.replace(/^\//, '').split('?')[0] ?? '';
  const isLocalHost = host === '127.0.0.1' || host === 'localhost';
  if (!isLocalHost || databaseName !== 'dev_db') {
    throw new Error(
      'Legacy import aborted: outside production, DATABASE_URL must target dev_db on 127.0.0.1 or localhost.'
    );
  }
}
