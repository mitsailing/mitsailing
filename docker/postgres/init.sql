-- Bootstraps the two logical databases our app expects on the standard
-- Postgres port. Compose mounts this script into
-- /docker-entrypoint-initdb.d/ on first boot only, so it is a no-op on
-- subsequent starts and will not clobber existing data.
--
-- `dev_db` is created by Compose via POSTGRES_DB, so we only add `test_db`
-- here. Playwright + Vitest point at `test_db` via TEST_DATABASE_URL and run
-- migrations into it independently.
CREATE DATABASE test_db;
