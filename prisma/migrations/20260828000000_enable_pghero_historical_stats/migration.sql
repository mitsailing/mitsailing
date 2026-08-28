-- PgHero 4 historical stats plus a dedicated monitoring role. Table DDL is
-- from https://github.com/ankane/pghero/blob/v4.0.1/guides/Docker.md.
-- SECURITY DEFINER helpers follow
-- https://github.com/ankane/pghero/blob/v4.0.1/guides/Permissions.md without
-- baking a role password into the migration.
CREATE TABLE pghero_queries (
    id bigserial PRIMARY KEY,
    query text
);
CREATE INDEX ON pghero_queries USING hash (query);

CREATE TABLE pghero_query_stats (
    id bigserial PRIMARY KEY,
    database text,
    "user" text,
    query_id bigint,
    query_hash bigint,
    total_time float,
    calls bigint,
    captured_at timestamp
);
CREATE INDEX ON pghero_query_stats (database, captured_at);

CREATE TABLE pghero_space_stats (
    id bigserial PRIMARY KEY,
    database text,
    schema text,
    relation text,
    size bigint,
    captured_at timestamp
);
CREATE INDEX ON pghero_space_stats (database, captured_at);

CREATE SCHEMA IF NOT EXISTS pghero;

CREATE OR REPLACE FUNCTION pghero.pg_stat_activity() RETURNS SETOF pg_stat_activity AS
$$
  SELECT * FROM pg_catalog.pg_stat_activity;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE VIEW pghero.pg_stat_activity AS SELECT * FROM pghero.pg_stat_activity();

CREATE OR REPLACE FUNCTION pghero.pg_terminate_backend(pid int) RETURNS boolean AS
$$
  SELECT pg_catalog.pg_terminate_backend(pid);
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION pghero.pg_stat_statements() RETURNS SETOF pg_stat_statements AS
$$
  SELECT * FROM public.pg_stat_statements;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE VIEW pghero.pg_stat_statements AS SELECT * FROM pghero.pg_stat_statements();

CREATE OR REPLACE FUNCTION pghero.pg_stat_statements_reset(userid oid, dbid oid, queryid bigint) RETURNS void AS
$$
  SELECT public.pg_stat_statements_reset(userid, dbid, queryid);
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION pghero.pg_stats() RETURNS
TABLE(schemaname name, tablename name, attname name, null_frac real, avg_width integer, n_distinct real) AS
$$
  SELECT schemaname, tablename, attname, null_frac, avg_width, n_distinct FROM pg_catalog.pg_stats;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE VIEW pghero.pg_stats AS SELECT * FROM pghero.pg_stats();

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'pghero') THEN
    CREATE ROLE pghero WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO pghero', current_database());
END
$$;

ALTER ROLE pghero SET search_path = pghero, pg_catalog, public;
ALTER ROLE pghero SET lock_timeout = '1s';

GRANT USAGE ON SCHEMA pghero TO pghero;
GRANT SELECT ON ALL TABLES IN SCHEMA pghero TO pghero;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA pghero TO pghero;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO pghero;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE pghero_queries, pghero_query_stats, pghero_space_stats TO pghero;
GRANT USAGE, SELECT ON SEQUENCE pghero_queries_id_seq, pghero_query_stats_id_seq, pghero_space_stats_id_seq TO pghero;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON SEQUENCES TO pghero;
ALTER DEFAULT PRIVILEGES IN SCHEMA pghero GRANT SELECT ON TABLES TO pghero;
ALTER DEFAULT PRIVILEGES IN SCHEMA pghero GRANT EXECUTE ON FUNCTIONS TO pghero;
