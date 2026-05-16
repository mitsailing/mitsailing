# Legacy MySQL Sync Design

## Goal

Mirror the old MIT Sailing website MySQL database `sailing` from `ak@sailing.mit.edu` into the new Mitsailing Postgres database under schema `legacy`, then use `legacy.reservations` as the raw source for legacy Pavilion reservation mapping.

## Source And Destination

- Remote source: MySQL database `sailing` on `ak@sailing.mit.edu`, accessed over SSH as `ak`.
- Local destination: the production Postgres database already used by the Mitsailing app.
- Local mirror schema: `legacy`.
- Source scope: all 52 base tables in MySQL database `sailing`; no MySQL views were found.
- Observed source size: about 174 MB by MySQL table stats. Largest tables are `dw`, `members`, `events`, `event_regs`, and `event_boats`.

## Architecture

The production worker owns the nightly sync. It opens an SSH connection to `ak@sailing.mit.edu`, tunnels to MySQL, introspects every base table and column in database `sailing`, recreates Postgres schema `legacy`, and bulk inserts every row into mirrored tables under that schema.

The sync is intentionally destructive only inside `legacy`:

1. `DROP SCHEMA IF EXISTS legacy CASCADE`
2. `CREATE SCHEMA legacy`
3. Create mirrored tables under `legacy`
4. Insert all rows from MySQL `sailing`
5. Record a sync-run row in app-owned metadata
6. Run legacy Pavilion reservation mapping from `legacy.reservations`

No staging schema is retained. During the sync, the `legacy` schema may be missing or partially loaded. This is acceptable because the mirror is operational raw data, not the app's source of truth.

## Data Safety

The sync must never drop, truncate, or recreate objects in `public`. SQL helpers must quote identifiers and must hard-code the destination schema name to `legacy` through a single exported `LEGACY_SCHEMA` constant. Mirror DDL and DML helpers must not accept a destination schema from config, env, CLI input, or function parameters.

All destructive DDL must route through one reset helper that returns exactly:

1. `DROP SCHEMA IF EXISTS "legacy" CASCADE`
2. `CREATE SCHEMA "legacy"`

Reservation mapping may upsert app-owned rows with legacy reference codes, but it must not delete native app reservation rows. Existing app data in `public` remains the durable source of truth for new website behavior.

## Secrets And Production Scope

The MySQL password and SSH private key are production-only secrets. They should not be committed and should not be passed on command lines. The worker should read them through validated environment variables and a mounted key file.

The scheduler should register only when `APP_ENV=production` and `LEGACY_MYSQL_SYNC_ENABLED=true`. Local and test environments can run the sync manually through unit-tested functions, but should not schedule it.

## Implementation Shape

Use Node code in the existing worker image rather than shelling out to `mysqldump`. The worker already has Redis, Postgres, and a long-lived process. A Node ETL keeps the image small and avoids MySQL-to-Postgres SQL dialect conversion.

Core units:

- MySQL metadata to Postgres column type mapping
- Safe Postgres identifier quoting and legacy-schema DDL helpers
- SSH tunnel and MySQL connection factory
- Postgres mirror loader
- Sync orchestrator with run metadata
- BullMQ scheduler registration
- Reservation mapping from `legacy.reservations`

## Error Handling

Failures should mark the sync run as failed with a short error summary and leave the worker alive for the next scheduled attempt. Because the design drops `legacy` at the beginning, a failed sync can leave `legacy` absent or partial until the next successful run. That is accepted by this design.

The worker should use BullMQ retries for transient failures, but the mirror loader should not retry individual SQL statements internally in a way that hides partial-state problems.

## Verification

Unit tests cover:

- MySQL column type to Postgres type mapping
- Identifier quoting, legacy-qualified table names, and refusal to operate outside `legacy`
- Create-table and insert SQL generation that always targets `"legacy"."table_name"`
- Mirror SQL safety checks that reject `public`, arbitrary schemas, `TRUNCATE`, and unexpected destructive SQL
- MySQL row value conversion for raw mirror inserts
- Legacy reservation row mapping from typed `legacy.reservations` rows, including proof that native app reservations are not deleted
- Scheduler registration only in production when explicitly enabled

Manual production verification:

- Confirm the worker logs a successful sync.
- Query `public.legacy_mysql_sync_runs`.
- Confirm `SELECT count(*) FROM information_schema.tables WHERE table_schema = 'legacy';` returns 52.
- Spot-check `legacy.reservations`, `legacy.members`, and `legacy.dw`.
