/**
 * PostgreSQL application_name for PgHero Top Sources and pg_stat_activity.
 *
 * @param argv - Process argv; defaults to `process.argv`.
 * @returns `mitsailing-worker` for the BullMQ worker entry, otherwise `mitsailing-web`.
 */
export function postgresApplicationName(
  argv: readonly string[] = process.argv
): string {
  const isWorker = argv.some(
    (arg) => arg.includes('worker.mjs') || arg.includes('src/worker')
  );
  return isWorker ? 'mitsailing-worker' : 'mitsailing-web';
}
