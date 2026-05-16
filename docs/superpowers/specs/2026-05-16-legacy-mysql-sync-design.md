# Legacy MySQL Sync Design

## Goal

Mirror the old MIT Sailing website MySQL database `sailing` into the new Mitsailing Postgres database under schema `legacy`, then use `legacy.reservations` as the raw source for legacy Pavilion reservation mapping.

## Source And Destination

- Remote source: MySQL database URL `mysql://dock_readonly:<password>@sailing.pavilion.lan:3306/sailing`, reachable directly from `sailing-dock.mit.edu`.
- Local destination: the production Postgres database already used by the Mitsailing app.
- Local mirror schema: `legacy`.
- Source scope: all 52 base tables in MySQL database `sailing`; no MySQL views were found.
- Observed source size: about 174 MB by MySQL table stats. Largest tables are `dw`, `members`, `events`, `event_regs`, and `event_boats`.

## Architecture

The production worker owns the hourly sync. It connects directly to MySQL at `sailing.pavilion.lan:3306` from `sailing-dock.mit.edu`, introspects every base table and column in database `sailing`, recreates Postgres schema `legacy`, and bulk inserts every row into mirrored tables under that schema.

The sync brings over all 52 tables together every hour, including `dw`. `dw` appears to change daily, but keeping it in the same full refresh avoids split schedules, per-table freshness rules, and partial mirror semantics in v1. The source database is about 174 MB, so a full hourly refresh is acceptable unless production measurements show it consistently overlaps the next run.

The MySQL user has read-only access to production database `sailing`, so v1 does not use triggers, source-side change tables, or binlog streaming. Change monitoring would be polling, and reliable content polling would approach the cost of a full refresh. The default is therefore full hourly refresh.

The sync is intentionally destructive only inside `legacy`:

1. `DROP SCHEMA IF EXISTS legacy CASCADE`
2. `CREATE SCHEMA legacy`
3. Create mirrored tables under `legacy`
4. Insert all rows from MySQL `sailing`
5. Record a sync-run row in app-owned metadata
6. Run legacy Pavilion reservation mapping from `legacy.reservations`

No staging schema is retained. The destructive mirror refresh should run inside one Postgres transaction after the worker has acquired a dedicated-session advisory lock. If a previous successful mirror exists, a failed run rolls back to that prior `legacy` schema instead of leaving a partial mirror. On the first run, `legacy` may still be absent until a sync succeeds.

## Data Safety

The sync must never drop, truncate, or recreate objects in `public`. SQL helpers must quote identifiers and must hard-code the destination schema name to `legacy` through a single exported `LEGACY_SCHEMA` constant. Mirror DDL and DML helpers must not accept a destination schema from config, env, CLI input, or function parameters.

All destructive DDL must route through one reset helper that returns exactly:

1. `DROP SCHEMA IF EXISTS "legacy" CASCADE`
2. `CREATE SCHEMA "legacy"`

Reservation mapping may upsert app-owned rows with legacy reference codes, but it must not delete native app reservation rows. Existing app data in `public` remains the durable source of truth for new website behavior.

## Secrets And Production Scope

The `dock_readonly` MySQL password is a production-only secret (`LEGACY_MYSQL_PASSWORD`). Host, user, and database are fixed in code. It should not be committed and should not be passed on command lines. The worker reads it through validated environment variables. No SSH tunnel, SSH key, or host `mysql-client` package is required for the planned runtime.

The scheduler should register only when `APP_ENV=production` and `LEGACY_MYSQL_SYNC_ENABLED=true`. The default schedule is hourly at minute zero. Local and test environments can run the sync manually through unit-tested functions, but should not schedule it.

## Implementation Shape

Use Node code in the existing worker image rather than shelling out to `mysqldump`. The worker already has Redis, Postgres, and a long-lived process. A Node ETL keeps the image small and avoids MySQL-to-Postgres SQL dialect conversion.

Core units:

- MySQL metadata to Postgres column type mapping
- Safe Postgres identifier quoting and legacy-schema DDL helpers
- Direct MySQL connection factory
- Postgres mirror loader
- Sync orchestrator with run metadata
- BullMQ scheduler registration
- Reservation mapping from `legacy.reservations`

## Error Handling

Failures should mark the sync run as failed with a short error summary and leave the worker alive for the next scheduled attempt. Because the mirror reset and load run in one Postgres transaction, a failed sync should preserve the previous successful `legacy` schema when one exists.

The worker should use BullMQ retries for transient failures, but the mirror loader should not retry individual SQL statements internally in a way that hides failed-run metadata. Each run must acquire a Postgres advisory lock on a checked-out `pg` client before dropping `legacy`; if the lock is already held, the worker records a skipped sync run and exits without touching `legacy` or running reservation mapping.

## Verification

Unit tests cover:

- MySQL column type to Postgres type mapping
- Identifier quoting, legacy-qualified table names, and refusal to operate outside `legacy`
- Create-table and insert SQL generation that always targets `"legacy"."table_name"`
- Mirror SQL safety checks that reject `public`, arbitrary schemas, `TRUNCATE`, and unexpected destructive SQL
- MySQL row value conversion for raw mirror inserts
- Transaction wrapper that commits successful mirror refreshes and rolls back failed refreshes
- Legacy reservation row mapping from typed `legacy.reservations` rows, including proof that native app reservations are not deleted
- Scheduler registration only in production when explicitly enabled
- Advisory-lock overlap prevention that skips a run without resetting `legacy`

Manual production verification:

- Confirm the worker logs a successful sync.
- Query `public.legacy_mysql_sync_runs`.
- Confirm `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'legacy';` returns 52.
- Spot-check `legacy.reservations`, `legacy.members`, and `legacy.dw`.
