---
name: pgsync-prod-to-local
description: >-
  Copy MIT Sailing production Postgres into local dev_db via pgsync: open
  production host loopback port, SSH tunnel, run pgsync, then close port and tunnel.
  Use when the user asks to pgsync, pull prod data, sync production database to
  local, or refresh dev_db from production.
---

# pgsync prod → local `dev_db`

Agent-run workflow for this repo. Uses [pgsync](https://github.com/ankane/pgsync) and `.pgsync.yml` at the repo root. **Always run cleanup** (port + tunnel) even if pgsync fails.

## Defaults (MIT Sailing)

| Setting | Value |
| --- | --- |
| SSH target | `username@example.com` |
| Docker network | `mitsailing_internal` |
| Loopback container | `mitsailing-pg-loopback` |
| Host port | `15432` |
| Prod DB name | `mitsailing_prod` |

Before running the commands, replace `username@example.com` with your SSH login
for the production host.

## Before starting

1. Repo root: `.pgsync.yml`, gitignored `.env` with `PGSYNC_FROM_URL` and `DATABASE_URL` (see `.env.example`).
2. `PGSYNC_FROM_URL` → `127.0.0.1:15432` on the laptop (after tunnel), **not** `postgres:5432`.
3. `DATABASE_URL` must name **`dev_db`** on `127.0.0.1` — abort if it looks like prod.
4. `pgsync` on PATH (`brew install pgsync` if missing).
5. Local schema exists: `npm run db:up` (if needed), then `npm run db:migrate` — pgsync copies **data only**.

## Workflow

Run steps in order. Use a `trap` or `finally`-style cleanup so step 4 always runs.

### 1. Open port on production host

```bash
ssh username@example.com 'docker rm -f mitsailing-pg-loopback 2>/dev/null; docker run -d --name mitsailing-pg-loopback \
  --network mitsailing_internal \
  -p 127.0.0.1:15432:5432 \
  alpine:3.21 \
  sh -c "apk add --no-cache socat >/dev/null && exec socat TCP-LISTEN:5432,fork,reuseaddr TCP:postgres:5432"'
```

Verify: `ssh username@example.com 'ss -tln | grep 15432 || netstat -tln 2>/dev/null | grep 15432'`

### 2. SSH tunnel (laptop, background)

```bash
ssh -f -N -o ExitOnForwardFailure=yes -L 15432:127.0.0.1:15432 username@example.com
```

Verify: `nc -z 127.0.0.1 15432`

### 3. pgsync (repo root)

```bash
set -a && source .env && set +a
test -n "$PGSYNC_FROM_URL" && test -n "$DATABASE_URL"
case "$DATABASE_URL" in
  *@127.0.0.1:*dev_db*|*@localhost:*dev_db*) ;;
  *) echo "DATABASE_URL must be local dev_db (127.0.0.1 or localhost)"; exit 1 ;;
esac
pgsync --defer-constraints --truncate --jobs 1
```

`.pgsync.yml`: `public` + `legacy`; excludes `_prisma_migrations`. `--defer-constraints` + `--jobs 1` per [pgsync FK guidance](https://github.com/ankane/pgsync#foreign-keys).

### 4. Cleanup (required)

```bash
pkill -f 'ssh.*-L 15432:127.0.0.1:15432.*example.com' 2>/dev/null || true
ssh username@example.com 'docker stop mitsailing-pg-loopback && docker rm mitsailing-pg-loopback' 2>/dev/null || true
```

## Safety

- Bind **127.0.0.1** only on the server; never `0.0.0.0`.
- Do not commit prod passwords or log `PGSYNC_FROM_URL`.
- `test_db` is not touched.

## Optional: install for all Cursor/Codex projects

Copy this folder to `~/.cursor/skills/pgsync-prod-to-local/` and adjust the defaults table for other hosts.
