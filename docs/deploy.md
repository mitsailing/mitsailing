# Production deploy runbook

This app ships as a **Docker image** on GitHub Container Registry (GHCR). Each
push to `main` builds and tags `ghcr.io/mitsailing/mitsailing:sha-<short>` and
`:latest`, then GitHub Actions SSHs to production and runs
`bin/deploy-two-host.sh release <sha-short>` (see `.github/workflows/deploy.yml`).
The legacy `bin/deploy.sh` path remains for older single-compose stacks.

The server can run **rootless Docker** (no `sudo` for day-to-day). You only need
`sudo` once if your distro requires **loginctl linger** so the Docker user
daemon survives logout/reboot (see below).

Ingress is usually **Cloudflare Tunnel** on the production host. CMS media still
needs **three public hostnames** (see [Public hostnames](#public-hostnames-cloudflare-or-equivalent)).

## MIT production today: one server (`sailing-dock`)

**Physical production is a single Linux host:** `ak@sailing-dock.mit.edu` (see
`bin/bootstrap-production-server.sh`). There are not three separate machines in
the datacenter — the repo’s “two app hosts + data server” names are **logical
roles** that can all SSH to the same box.

On that one server you typically run **two Compose projects** in
`~/apps/mitsailing/`:

| Compose project | File | Services |
| --- | --- | --- |
| `mitsailing-data` | `compose.prod.data.yaml` | `postgres`, `redis`, `tusd`, `worker`, `media` |
| `mitsailing` (app) | `compose.prod.app-host.yaml` | `web` (Next.js) |

GitHub Actions can set all three deploy secrets to the **same** SSH target, for
example `ak@sailing-dock.mit.edu`. `bin/deploy-two-host.sh` still tracks blue/green
**state** (`.deploy/two-host-active`, traffic file) on that host; it does not
require two physical app servers.

**Do not** run `compose.prod.data.yaml` **and** the old
`compose.yaml` + `compose.prod.yaml` Postgres/Redis at the same time — you would
start two databases on one machine. Migrate off the legacy stack (below) or stay
on legacy until tusd/media are added there.

**Older stack (still in repo):** `compose.yaml` + `compose.prod.yaml` on one host
with `web_blue` / `web_green`, `worker`, and `cloudflared` → internal `app` nginx.
That path uses `bin/deploy.sh` and does **not** include `tusd` or static media
nginx until you migrate.

## Logical roles (same idea on one or many machines)

Whether everything runs on `sailing-dock` or is split across VMs later, the roles
are:

| Role | Runs |
| --- | --- |
| App (blue/green or single `web`) | Next.js — sessions, finalize, admin |
| Data/media | `postgres`, `redis`, `tusd`, `worker`, `media` (nginx for ready files) |

Multi-host production (optional future) puts app containers on two hosts behind
Cloudflare Load Balancing and keeps Postgres/`tusd`/worker/media on
`sailing-dock` or another data host. That adds failover for app deploys only;
the data server remains a single point of failure until you add data-tier HA.

Media storage is local to the data/media server. Do **not** add R2, S3, MinIO,
or another object store for this architecture. Uploaded media lives under:

```text
/srv/mitsailing-data/cms-media
```

Upload flow:

1. The browser asks an app host to create an upload session.
2. The browser uploads bytes directly to `tusd` on the data/media server.
3. The app host finalizes the session and enqueues BullMQ processing.
4. The worker moves validated files into ready media paths under
   `/srv/mitsailing-data/cms-media`.
5. Static media nginx on the data/media server serves ready media.

The app hosts only create/finalize sessions and enqueue BullMQ work; upload
request bodies do not stream through the app hosts. That prevents app deploys
or app-host cutovers from interrupting active upload bodies.

Uploads use pinned `tusd` (`tusproject/tusd:v2.9.2`) with local disk storage
under `/srv/mitsailing-data/cms-media/uploads`. App deploys and rollbacks must
not recreate `tusd`; only an explicit late-night maintenance window should
restart or upgrade it, because active uploads can be disrupted.

## Production topologies

| Topology | When | Compose | Deploy |
| --- | --- | --- | --- |
| **Single-server (MIT today)** | One host (`sailing-dock`) | `compose.prod.data.yaml` + `compose.prod.app-host.yaml` in the same `~/apps/mitsailing` | `bin/deploy-two-host.sh`; CI secrets may all be `ak@sailing-dock.mit.edu` |
| **Multi-host (optional)** | Separate app VMs later | Data compose on data host; app compose on each app host | Same script; different SSH targets per secret |
| **Legacy single-compose** | Pre-tusd / pre-split | `compose.yaml` + `compose.prod.yaml` | `bin/deploy.sh`; `cloudflared` → `app` nginx → `web_blue` / `web_green` |

Unless a section says **legacy single-compose**, it assumes the **split compose
files on one or more hosts** (data + app).

## Public hostnames (Cloudflare or equivalent)

CMS media needs **three public HTTPS names**. Env examples use
`mitsailing.com`, `uploads.mitsailing.com`, and `media.mitsailing.com`; replace
with your real zone.

| Public hostname | Serves | On **sailing-dock** (one server) | On **multi-host** (future) |
| --- | --- | --- | --- |
| `mitsailing.com` | Next.js (`web`) | Tunnel/LB → `http://127.0.0.1:3000` (app compose) or legacy `http://app:3000` | Tunnel/LB → each app host `:3000` |
| `uploads.mitsailing.com` | `tusd` | Tunnel → `http://127.0.0.1:3001` (or `${UPLOAD_SERVICE_PORT}`) | Tunnel/LB → data host tus port |
| `media.mitsailing.com` | nginx `media` | Tunnel → `http://127.0.0.1:8080` (or `${MEDIA_HTTP_PORT}`) | Tunnel/LB → data host media port |

`compose.prod.data.yaml` publishes tus and media on the host via
`UPLOAD_SERVICE_BIND_HOST` / `MEDIA_HTTP_BIND_HOST`. On a single server, set
both to `127.0.0.1` and add **extra public hostnames** on the existing Cloudflare
Tunnel (Zero Trust → your tunnel → Public Hostname). Postgres and Redis use
`DATA_PRIVATE_BIND_HOST` (also `127.0.0.1` on one box); do not expose them on the
public internet.

**What runs in Docker (data/media server):** service keys `postgres`, `redis`,
`tusd`, `worker`, and `media`. The BullMQ processor is **`worker`** (not
`media-worker`).

### Env vars that must match across hosts

Set on **each app host** (`.env.production.app-host`) and on the **data/media
server** (`.env.production.data`) where noted:

| Variable | Example | Notes |
| --- | --- | --- |
| `MEDIA_UPLOAD_BASE_URL` | `https://uploads.mitsailing.com` | Browser tus endpoint; readiness checks `…/cms-media/uploads/` |
| `MEDIA_PUBLIC_BASE_URL` | `https://media.mitsailing.com` | Public URLs for ready assets |
| `MEDIA_UPLOAD_SHARED_SECRET` | 32+ random chars | **Same value** on app hosts and data server |
| `MEDIA_UPLOAD_CORS_ALLOW_ORIGIN` | `https://mitsailing.com` | Data server only; `tusd` CORS |
| `TUSD_HOOKS_HTTP_URL` | `https://mitsailing.com/api/internal/cms-media/tusd/hooks` | Data server only; must be reachable **from the data host** (LB or tunnel to app, not Docker service name `web`) |
| `NEXT_PUBLIC_APP_URL` | `https://mitsailing.com` | App hosts |

### Cloudflare setup on `sailing-dock`

1. Open **Cloudflare Zero Trust** → **Networks** → **Tunnels** → the tunnel that
   already serves `mitsailing.com` (legacy stack uses `cloudflared` in
   `compose.prod.yaml`; after migration you may run `cloudflared` on the host or
   keep it in compose — either way, hostnames are configured in the dashboard).
2. Add **Public Hostname** routes (all on the same tunnel):
   - `mitsailing.com` → `http://127.0.0.1:3000` (split stack `web`) **or**
     `http://app:3000` (legacy nginx proxy) — use whichever stack is live.
   - `uploads.mitsailing.com` → `http://127.0.0.1:3001` (requires `tusd` from
     `compose.prod.data.yaml`).
   - `media.mitsailing.com` → `http://127.0.0.1:8080` (requires `media` nginx from
     `compose.prod.data.yaml`).
3. TLS: **Full** or **Full (strict)** at Cloudflare; `tusd` uses `-behind-proxy`.
4. Confirm `MEDIA_UPLOAD_CORS_ALLOW_ORIGIN=https://mitsailing.com` on the data
   env file.
5. Large uploads use tus chunks; confirm Cloudflare limits fit
   `MEDIA_UPLOAD_MAX_BYTES` (default 100 MiB).

`compose.prod.app-host.yaml` and `compose.prod.data.yaml` do **not** bundle
`cloudflared`; the tunnel connector may still be the legacy `cloudflared` service
until you move it. Extra hostnames are dashboard config, not a second server.

### Verify hostnames before go-live

From your workstation (replace hostnames if different):

```bash
curl -fsSI "https://mitsailing.com/api/health/live"
curl -fsSI "https://uploads.mitsailing.com/cms-media/uploads/"
curl -fsSI "https://media.mitsailing.com/healthz"
```

From the **data/media server** (hooks must reach a live app, not a Docker name
on the data compose network):

```bash
curl -fsSI "https://mitsailing.com/api/internal/cms-media/tusd/hooks"
# Expect 405 Method Not Allowed for GET — that still proves TLS + routing work.
```

---

## What you need on the server

| Requirement | Notes |
| --- | --- |
| Docker Engine + Compose v2 | Rootless is fine; same user runs `docker compose` |
| SSH access | Interactive key for you; **separate** deploy key for CI |
| `docker login ghcr.io` | Once per user, PAT with `read:packages` if the image is private |
| **Production host** | One machine today: `sailing-dock.mit.edu` (see [MIT production today](#mit-production-today-one-server-sailing-dock)) |
| Directory `~/apps/mitsailing/` | Split stack: `compose.prod.data.yaml`, `compose.prod.app-host.yaml`, env files, `bin/deploy-two-host.sh`; legacy also keeps `compose.yaml` + `compose.prod.yaml` until removed |
| Directory `/srv/mitsailing-data/` | Postgres, Redis, CMS media bind mounts (create on `sailing-dock`) |
| Cloudflare (or equivalent) | Three public hostnames — [Public hostnames](#public-hostnames-cloudflare-or-equivalent) |

**Multiple projects on one host:** each app should use a **unique Compose
project name**. This repo sets `name: mitsailing` in `compose.yaml`. A second
copy of the same file would collide; either use a separate machine, or change
`name:` (or set `COMPOSE_PROJECT_NAME` when invoking compose — not wired into
`deploy.sh` today).

---

## One-time setup (no `sudo` except optional linger)

### 1. Optional — keep rootless Docker alive after reboot (one-time admin)

If containers die after you log out or reboot until someone logs in again, an
admin with `sudo` runs **once**:

```bash
sudo loginctl enable-linger YOUR_LINUX_USERNAME
```

If you truly have **no** `sudo` anywhere, ask the host admin to enable linger
for your UID, or accept starting Docker after login.

### 2. Create the app directory and copy files

On the server as your deploy user:

```bash
mkdir -p ~/apps/mitsailing/docker/postgres ~/apps/mitsailing/docker/nginx
cd ~/apps/mitsailing

# From a clone of this repo on your laptop, scp or cp:
#   compose.yaml compose.prod.yaml compose.prod.app-host.yaml
#   compose.prod.data.yaml docker/postgres/init.sql docker/nginx/media.conf
#   bin/deploy.sh bin/deploy-two-host.sh
# Example from your workstation:
#   scp compose.yaml compose.prod*.yaml YOUR_USER@YOUR_HOST:~/apps/mitsailing/
#   scp docker/postgres/init.sql YOUR_USER@YOUR_HOST:~/apps/mitsailing/docker/postgres/
#   scp docker/nginx/media.conf YOUR_USER@YOUR_HOST:~/apps/mitsailing/docker/nginx/
#   scp bin/deploy*.sh YOUR_USER@YOUR_HOST:~/

chmod +x ~/deploy.sh ~/deploy-two-host.sh
```

`bin/deploy.sh` defaults to `DEPLOY_DIR=$HOME/apps/mitsailing`. If you use a
different path, set `DEPLOY_DIR` in the `authorized_keys` line (see below) or
edit the script. For the two-app-host topology, `bin/deploy-two-host.sh` is a
controller script run by CI or an operator and SSHs into both app hosts plus
the data/media server.

### 3. Configure production env files

For the two-app-host topology, copy `.env.production.example` to
`.env.production.app-host` on each app host and copy
`.env.production.data.example` to `.env.production.data` on the data/media
server. The legacy single-host compose path can still use `.env.production`.

```bash
# On each app host
cd ~/apps/mitsailing
cp /path/to/repo/.env.production.example .env.production.app-host
mkdir -p .deploy
printf 'false\n' > .deploy/traffic-enabled
$EDITOR .env.production.app-host

# On the data/media server
cd ~/apps/mitsailing
cp /path/to/repo/.env.production.data.example .env.production.data
cp /path/to/repo/.env.production.worker.example .env.production.worker
$EDITOR .env.production.data
```

Fill at least:

- `BETTER_AUTH_SECRET` (32+ random chars)
- `HEALTHCHECK_SECRET` (32+ random chars; used only by protected readiness
  checks, not by public `/api/health/live`)
- `DATABASE_URL` — on the app compose (`web`), point at Postgres on the same
  machine, e.g. `postgresql://…@127.0.0.1:5432/mitsailing_prod` when
  `DATA_PRIVATE_BIND_HOST=127.0.0.1`. On the data compose, use host `postgres`.
  Production defaults to database name **`mitsailing_prod`**.
- `POSTGRES_PASSWORD` — strong password; same value embedded in `DATABASE_URL`
- `REDIS_URL` — on the app compose, e.g. `redis://127.0.0.1:6379` when Redis is
  published on localhost; on the data compose use `redis://redis:6379`.
- `TUSD_HOOKS_HTTP_URL` — on the data/media server, point this at
  `https://mitsailing.com/api/internal/cms-media/tusd/hooks` or a private
  load-balanced app ingress reachable from the data/media server. Do not point
  it at Docker service name `web`; `tusd` runs in the data/media Compose
  project, not the app-host project.
- `MEDIA_UPLOAD_BASE_URL`, `MEDIA_PUBLIC_BASE_URL`, and `MEDIA_UPLOAD_SHARED_SECRET`
  — set on **app hosts and** the data/media server (same secret everywhere).
  See [Public hostnames](#public-hostnames-cloudflare-or-equivalent).
- `MEDIA_UPLOAD_MAX_BYTES` and `MEDIA_UPLOAD_CORS_ALLOW_ORIGIN` — data/media
  server settings consumed by `tusd`.
- `UPLOAD_SERVICE_BIND_HOST`, `UPLOAD_SERVICE_PORT`, `MEDIA_HTTP_BIND_HOST`,
  `MEDIA_HTTP_PORT`, `DATA_PRIVATE_BIND_HOST` — data/media server bind addresses
  for `tusd`, static media nginx, and private Postgres/Redis.
- Optional **`DEPLOYMENT_VERSION`** — same string on every web container when
  using rolling deploys or multiple replicas (wired to Next.js `deploymentId`;
  image tag or git SHA is typical).
- If you see Sentry noise from monitoring probes, exclude `/api/health/*`
  from tracing/error capture in `src/instrumentation.ts` (the deploy liveness
  and readiness checks are intentionally frequent).
- Optional **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — required before running
  **more than one** `app` replica or overlapping rolling deploys (see Next.js
  data security docs).
- `NEXT_PUBLIC_APP_URL=https://mitsailing.com` — must match the URL baked
  into the image by GitHub Actions (`deploy.yml` `build-arg`); the production
  host’s `.env.production` should use the **same** value for runtime `Env`
  (the host file is **not** read during the CI image build).
- `HOST_TRAFFIC_STATE_FILE=/run/mitsailing/traffic-enabled` on app hosts; the
  deploy script flips the mounted `.deploy/traffic-enabled` file without
  restarting the app so the load balancer can drain/promote hosts cleanly.
- `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` (real mail; there is no
  Mailpit in production)

**Sentry (errors + source maps):** The production image is built in GitHub
Actions (`.github/workflows/deploy.yml`), not on the VM. Add these on the
**`production` environment** (same place as deploy SSH secrets) so the Docker
build can inline the DSN and upload source maps during `next build`:

| Secret | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SENTRY_DSN` | Client/server SDK DSN; baked into the bundle at build time. |
| `SENTRY_AUTH_TOKEN` | Build-only auth for `@sentry/webpack-plugin` (do **not** put this in `.env.production` on the host). |

Optional `NEXT_PUBLIC_SENTRY_DSN` on the server is documented in
`.env.production.example`; it does **not** replace CI for inlined `NEXT_PUBLIC_*`.

The workflow passes `NEXT_PUBLIC_SENTRY_DISABLED` as empty for that build so
Sentry and `withSentryConfig` are active. PR and local Docker builds default to
Sentry disabled in the `Dockerfile`. If the `production` environment uses
**required reviewers**, the **Build + push image** job also waits on approval;
relax rules or duplicate these values as **repository** secrets if you need
fully unattended image builds.

**Cloudflare / DNS:** configure all three public hostnames before relying on
admin uploads. See [Public hostnames](#public-hostnames-cloudflare-or-equivalent).

**Legacy single-host only:** point `mitsailing.com` at `http://app:3000` on the
tunnel (`cloudflared` in `compose.prod.yaml`). Internal `app` is nginx;
`web_blue` and `web_green` are the Next.js containers. Upload/media subdomains
still apply if you run `tusd` and `media` on that host or on a separate data
server — use the same hostname table.

### Legacy MySQL mirror worker secrets

The worker can mirror the old website MySQL database `sailing` from the
production host network into Postgres schema `legacy`.

Create a worker-only env file on the production host:

```bash
cd ~/apps/mitsailing
cp .env.production.worker.example .env.production.worker
$EDITOR .env.production.worker
```

Set `LEGACY_MYSQL_PASSWORD` for the read-only `dock_readonly` user (host
`sailing.pavilion.lan:3306`, database `sailing` — fixed in app code). Do not
commit the filled worker env file.

**Enable / disable:** Production cron is disabled by env right now. Set
`LEGACY_MYSQL_SYNC_ENABLED=true` on the worker/data-server env only after MySQL
connectivity is confirmed (example file ships with `false`). That is the master
switch — do not blank or comment out `LEGACY_MYSQL_SYNC_CRON` to turn sync off.
BullMQ runs jobs, but cron scheduling still needs this env flag. When disabled,
the worker removes any existing BullMQ scheduler on startup.

**Schedule:** When enabled, the worker registers a BullMQ job scheduler (not
system `crontab`). Default `LEGACY_MYSQL_SYNC_CRON` is hourly at minute 0
(`"0 0 * * * *"` — six fields, seconds first). Quote the value in
`.env.production.worker` so loaders keep the full expression.

To turn production cron on later, edit the worker/data-server env file:

```dotenv
LEGACY_MYSQL_SYNC_ENABLED=true
LEGACY_MYSQL_SYNC_CRON="0 0 * * * *"
```

Use a different quoted six-field cron value if needed. Then recreate/restart
only the worker container.

**Two-app-host topology (data/media server):**

```bash
cd ~/apps/mitsailing
docker compose -f compose.prod.data.yaml \
  --env-file .env.production.data --env-file .env.production.worker \
  --env-file .env.image \
  up -d --no-deps --force-recreate worker
```

**Legacy single-host topology:**

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  --env-file .env.production --env-file .env.production.worker \
  up -d --no-deps --force-recreate worker
```

The worker connects from `sailing-dock.mit.edu`. Confirm MySQL allows
`dock_readonly` from the production host or container network before setting
`LEGACY_MYSQL_SYNC_ENABLED=true`.

Connectivity check (uses worker env files; password stays in the worker file).

**Two-app-host topology (data/media server):**

```bash
cd ~/apps/mitsailing
docker compose -f compose.prod.data.yaml \
  --env-file .env.production.data --env-file .env.production.worker \
  run --rm --no-deps worker node - <<'NODE'
const mysql = require('mysql2/promise');
const password = process.env.LEGACY_MYSQL_PASSWORD;
if (!password) throw new Error('LEGACY_MYSQL_PASSWORD missing');
mysql
  .createConnection({
    database: 'sailing',
    host: 'sailing.pavilion.lan',
    password,
    port: 3306,
    user: 'dock_readonly',
  })
  .then((c) => c.query('SELECT 1').then(() => c.end()))
  .then(() => console.log('ok'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
NODE
```

**Legacy single-host topology:**

```bash
cd ~/apps/mitsailing
docker compose -f compose.yaml -f compose.prod.yaml \
  --env-file .env.production --env-file .env.production.worker \
  run --rm worker node - <<'NODE'
const mysql = require('mysql2/promise');
const password = process.env.LEGACY_MYSQL_PASSWORD;
if (!password) throw new Error('LEGACY_MYSQL_PASSWORD missing');
mysql
  .createConnection({
    database: 'sailing',
    host: 'sailing.pavilion.lan',
    password,
    port: 3306,
    user: 'dock_readonly',
  })
  .then(async (connection) => {
    await connection.query('select 1');
    await connection.end();
  });
NODE
```

After deploy:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 worker
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production \
  exec postgres psql -U postgres -d "${POSTGRES_DB:-mitsailing_prod}" -c \
  "select count(*) from information_schema.tables where table_schema = 'legacy';"
```

### 4. Create the production data root

Production state lives in explicit host directories, not Docker-managed named
volumes:

```text
/srv/mitsailing-data/postgres
/srv/mitsailing-data/redis
/srv/mitsailing-data/cms-media
```

For the two-host topology, create these directories on the data/media server.
The existing bootstrap script is still useful for the legacy single-host stack,
but it is not a full two-host setup because it targets `compose.prod.yaml`.
The init SQL is mounted read-only by `compose.prod.data.yaml`:

```bash
bin/bootstrap-production-server.sh
```

If you are maintaining the legacy single-host stack, you can still check the
local Compose validation and resolved defaults without touching the server:

```bash
bin/bootstrap-production-server.sh --check-only
```

The script defaults to `ak@sailing-dock.mit.edu`. Override when needed:

```bash
PRODUCTION_SSH_TARGET=DEPLOY_USER@YOUR_HOST \
DEPLOY_USER=DEPLOY_USER \
bin/bootstrap-production-server.sh
```

If the deploy user's primary group is not the same as the username, set
`DEPLOY_GROUP` explicitly:

```bash
PRODUCTION_SSH_TARGET=DEPLOY_USER@YOUR_HOST \
DEPLOY_USER=DEPLOY_USER \
DEPLOY_GROUP=DEPLOY_GROUP \
bin/bootstrap-production-server.sh
```

If this is an intentional reset and you want to remove the old Docker-managed
production volumes at the same time:

```bash
bin/bootstrap-production-server.sh --remove-old-docker-volumes
```

Manual equivalent:

```bash
sudo mkdir -p /srv/mitsailing-data/{postgres,redis,cms-media/uploads}
sudo chown -R DEPLOY_USER:DEPLOY_USER /srv/mitsailing-data
sudo chmod 700 /srv/mitsailing-data
sudo chmod 700 /srv/mitsailing-data/postgres
sudo chmod 700 /srv/mitsailing-data/redis
sudo chmod 700 /srv/mitsailing-data/cms-media
sudo chmod 700 /srv/mitsailing-data/cms-media/uploads
```

The data/media server requires `/srv/mitsailing-data` to exist and be writable
by the deploy user before `compose.prod.data.yaml` starts. Create the
`postgres`, `redis`, `cms-media`, and `cms-media/uploads` subdirectories, then
verify the running containers use bind mounts at:

| Host path | Container path | Services |
| --- | --- | --- |
| `/srv/mitsailing-data/postgres` | `/var/lib/postgresql` | `postgres` |
| `/srv/mitsailing-data/redis` | `/data` | `redis` |
| `/srv/mitsailing-data/cms-media/uploads` | `/srv/mitsailing-data/cms-media/uploads` | `tusd` |
| `/srv/mitsailing-data/cms-media` | `/srv/mitsailing-data/cms-media` | `worker`, `media` |

CMS media must be writable by `tusd` and worker containers and readable by the
static media nginx container. App hosts do not mount this folder.

Because these are ordinary host directories, `docker compose down -v` can remove
Compose-managed development volumes, but it does **not** delete
`/srv/mitsailing-data/postgres`, `/srv/mitsailing-data/redis`, or
`/srv/mitsailing-data/cms-media`.

Back up CMS media directly from the host path:

```bash
backup_file="mitsailing-cms-media-backup-$(date -u +%Y%m%dT%H%M%SZ).tgz"
sudo tar czf "$backup_file" -C /srv/mitsailing-data/cms-media .
```

### 5. GHCR pull authentication

```bash
# PAT needs read:packages for private images; public images may pull anonymously.
install -m 600 /dev/stdin ~/.ghcr-token <<'EOF'
ghp_your_token_here
EOF
docker login ghcr.io --username YOUR_GITHUB_USERNAME --password-stdin < ~/.ghcr-token
```

### 6. Lock down the deploy SSH key

Generate a **dedicated** key pair for GitHub Actions (not your personal key):

```bash
# On your workstation
ssh-keygen -t ed25519 -f ./mitsailing-deploy -C 'mitsailing gh actions deploy' -N ''
```

On all three production hosts, add the **public** key to `~/.ssh/authorized_keys`
for the deploy user. The two-host controller must run SSH, `scp`,
`docker pull`, `docker compose`, and small file writes on each host, so do not
use the legacy single-command `deploy.sh` restriction for this key. Keep the
usual non-interactive restrictions:

```text
no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA...rest-of-public-key... comment
```

If you keep the legacy single-host `bin/deploy.sh` path for another environment,
that environment can still use a forced-command deploy key. Do not reuse that
restricted key for the two-host controller.

Keep your **personal** SSH key in `authorized_keys` **without** `command=` so
you can still open a normal shell.

### 7. First bring-up on `sailing-dock` (one SSH session)

SSH `ak@sailing-dock.mit.edu`, then start the **data** stack, then the **app**
stack. Use `127.0.0.1` bind hosts in `.env.production.data` when everything is
on one machine.

```bash
cd ~/apps/mitsailing

# Data plane (project name mitsailing-data)
docker compose -f compose.prod.data.yaml \
  --env-file .env.production.data --env-file .env.production.worker \
  up -d postgres redis tusd media worker

# App plane (project name mitsailing)
mkdir -p .deploy
printf 'false\n' > .deploy/traffic-enabled
APP_IMAGE=ghcr.io/mitsailing/mitsailing:latest docker compose \
  -f compose.prod.app-host.yaml \
  --env-file .env.production.app-host up -d web
```

Configure Cloudflare tunnel hostnames (see [Cloudflare setup on sailing-dock](#cloudflare-setup-on-sailing-dock)) before testing admin uploads.

After the containers are healthy, run the first release from CI or your laptop
(SSH to `sailing-dock`; all three env vars can be the same host):

```bash
APP_HOST_BLUE=ak@sailing-dock.mit.edu \
APP_HOST_GREEN=ak@sailing-dock.mit.edu \
DATA_MEDIA_HOST=ak@sailing-dock.mit.edu \
bin/deploy-two-host.sh release latest
```

After the first successful deploy, day-to-day updates are **only** from GitHub
(`push` to `main` or **Actions → Deploy (production) → Run workflow**).

Release jobs **scp** deploy files to every SSH target in the workflow (on MIT
prod that is the same `sailing-dock` path three times).

Production releases use blue/green **state** on disk. The release command writes
`.env.image`, runs Prisma migrations once from the data compose, recreates the
`worker`, checks `web` with `/api/health/ready?mode=service`, flips
`.deploy/traffic-enabled`, and waits for public readiness. On one server that is
still a single `web` container — the traffic file gates public readiness. Keep
migrations backward-compatible across at least one release: add before using,
avoid same-release destructive drops/renames, and remove old columns only after
deployed code no longer reads them.

Normal `release` and `rollback` runs recreate app hosts plus the worker only;
they do not recreate `tusd`. Restart `tusd` only through an explicit
maintenance command, after scheduling a low-traffic window because active tus
uploads can be interrupted:

```bash
APP_HOST_BLUE=ak@sailing-dock.mit.edu \
APP_HOST_GREEN=ak@sailing-dock.mit.edu \
DATA_MEDIA_HOST=ak@sailing-dock.mit.edu \
bin/deploy-two-host.sh tusd-maintenance latest
```

Expand/contract checklist (for schema changes):
- Add new columns/tables/enums values in the first migration; backfill as needed.
- Deploy code that can read the old schema and the expanded schema.
- Only after the next release (when all instances are on the new code): contract
  (drop/rename old columns, remove legacy enum labels, etc.).

Health readiness (`/api/health/ready`) checks Postgres, Redis, the data/media
`tusd` upload service, static media nginx, and the host traffic gate.
`mode=service` skips only the traffic gate so deploy automation can validate an
inactive host before it receives public traffic. Make sure Postgres `max_connections`
comfortably exceeds concurrent Prisma clients across both app hosts and the
worker; readiness probes are bounded and apply a server-side
`statement_timeout`.

### 8. GitHub repository configuration

Create environment **`production`** (Settings → Environments) with URL
`https://mitsailing.com` if you like. Add **Required reviewers** on that
environment so production deploys wait for explicit approval (recommended).

Add secrets used by `.github/workflows/deploy.yml`:

| Secret | Value |
| --- | --- |
| `PRODUCTION_APP_HOST_BLUE` | SSH target for blue app role — on MIT prod use `ak@sailing-dock.mit.edu` (same host is OK) |
| `PRODUCTION_APP_HOST_GREEN` | SSH target for green app role — same as blue on one server |
| `PRODUCTION_DATA_MEDIA_HOST` | SSH target for data/media role — `ak@sailing-dock.mit.edu` |
| `PRODUCTION_SSH_PRIVATE_KEY` | Full PEM of **mitsailing-deploy** private key |
| `PRODUCTION_SSH_HOST_KEY` | Pinned `ssh-keyscan` line(s) for `sailing-dock.mit.edu` (one line is enough when all roles share one host) |

Optional environment variable:

| Variable | Value |
| --- | --- |
| `PRODUCTION_REMOTE_APP_DIR` | Remote app directory relative to the deploy user home; defaults to `apps/mitsailing` |

Optional **PR preview** host (`.github/workflows/preview.yml`) — use **repository**
secrets so jobs can run without environment protection deadlocks:

| Secret | Value |
| --- | --- |
| `PREVIEW_SSH_USER` | Linux username on the preview host |
| `PREVIEW_SSH_HOST` | Hostname or IP |
| `PREVIEW_SSH_PRIVATE_KEY` | Dedicated key for preview/teardown |
| `PREVIEW_SSH_HOST_KEY` | One line from `ssh-keyscan PREVIEW_HOST` |

Each deploy pushes an image tag `pr-<number>-<12-char-sha>`. The teardown job
runs `preview-down <number>` over SSH; implement that command on the server
(e.g. `docker compose -p mitsailing-pr-<number> down`) and lock it in
`authorized_keys` the same way as `deploy.sh`.

---

## Database admin access

Production Postgres is **not** published on the host by default (Compose network
only). Use your **personal** SSH key (not the CI deploy key).

On **`sailing-dock.mit.edu`**, open an ephemeral **127.0.0.1** forward on the
server, tunnel from your laptop, then connect GUI tools or `psql` at
`127.0.0.1:15432`. Full steps (including mandatory cleanup) are in
[`.cursor/skills/pgsync-prod-to-local/SKILL.md`](../.cursor/skills/pgsync-prod-to-local/SKILL.md)
(steps 1–2 for admin access; step 3 is optional [pgsync](https://github.com/ankane/pgsync)
prod → local `dev_db` only).

Broader patterns (Cloudflare private TCP, generic SSH forward): [devops_plan.md](./devops_plan.md) §5.5.

---

## PR preview deployments

When `PREVIEW_SSH_*` secrets are set, `.github/workflows/preview.yml` builds and
pushes a GHCR image per PR and runs teardown on `pull_request` **closed**. Wire
the preview host to pull that tag and run Compose with a dedicated
`COMPOSE_PROJECT_NAME` or stack name per PR; never point previews at the
production database.

---

## Day-to-day

- **Deploy:** merge to `main` (automatic, after **production** environment
  approval if configured) or run the Deploy workflow with a specific `ref` SHA
  for rollback.
- **Rollback app/worker to the previous image (does not reverse DB migrations):**

  ```bash
  APP_HOST_BLUE=ak@sailing-dock.mit.edu \
    APP_HOST_GREEN=ak@sailing-dock.mit.edu \
    DATA_MEDIA_HOST=ak@sailing-dock.mit.edu \
    bin/deploy-two-host.sh rollback previous
  ```

- **Rollback app/worker to an explicit image tag:**

  ```bash
  APP_HOST_BLUE=ak@sailing-dock.mit.edu \
    APP_HOST_GREEN=ak@sailing-dock.mit.edu \
    DATA_MEDIA_HOST=ak@sailing-dock.mit.edu \
    bin/deploy-two-host.sh rollback sha-abc123def456
  ```

  Rollback flips deploy state and recreates containers on `sailing-dock`. It
  cannot undo already-applied DB migrations,
  deleted media, data corruption, or non-backward-compatible schema changes.

- **Logs:**

  ```bash
  cd ~/apps/mitsailing
  docker compose -f compose.prod.app-host.yaml --env-file .env.production.app-host logs -f --tail 100 web
  docker compose -f compose.prod.data.yaml --env-file .env.production.data --env-file .env.production.worker logs -f --tail 100 worker
  ```

- **Status:**

  ```bash
  docker compose -f compose.prod.app-host.yaml --env-file .env.production.app-host ps
  docker compose -f compose.prod.data.yaml --env-file .env.production.data --env-file .env.production.worker ps
  ```

## Operations checklist

- **DNS / Cloudflare:** `mitsailing.com`, `uploads.mitsailing.com`, and
  `media.mitsailing.com` route to the correct origins; run the verification
  commands in [Public hostnames](#public-hostnames-cloudflare-or-equivalent).
- **Deploy:** on `sailing-dock`, confirm `web` can reach Postgres/Redis on
  localhost, readiness sees `tusd` and `media`, then run CI or
  `bin/deploy-two-host.sh release`.
- **Rollback:** `bin/deploy-two-host.sh rollback` on the same host; do not assume rollback reverses
  migrations, media deletes, data corruption, or incompatible schema changes.
- **File permissions:** keep `/srv/mitsailing-data` and subdirectories owned by
  the deploy/runtime user expected by Docker; verify `cms-media` is writable by
  `tusd` and worker, and readable by static media nginx.
- **Postgres:** keep it on the data/media server; verify health before app
  cutover; keep migrations backward-compatible across at least one release; back
  up before risky schema changes.
- **Redis:** keep append-only persistence enabled; verify worker connectivity
  and BullMQ queues after deploy; remember cron scheduling requires
  `LEGACY_MYSQL_SYNC_ENABLED=true`.
- **Media storage:** store uploads only in `/srv/mitsailing-data/cms-media`; do
  not configure R2, S3, or MinIO; verify direct browser uploads hit the
  data/media server `tusd` service, not an app host.
- **Backups:** back up Postgres, Redis persistence if needed for queue recovery,
  and `/srv/mitsailing-data/cms-media`; test restores before relying on the
  backup procedure.

## Optional: staging stack (Mailpit)

For a **non-production** environment with captured email, use
`compose.staging.yaml` and `.env.staging` instead. That path is **not** wired into
`deploy.sh` anymore; keep staging on a separate host or swap the compose files
in a fork. See `compose.staging.yaml` and `.env.staging.example`.

---

## Key rotation

1. `ssh-keygen -t ed25519 -f /tmp/deploy-new -C 'mitsailing gh deploy'`
2. Append the new **public** key to `authorized_keys` with the same `command=`
   line as the old key.
3. Update `PRODUCTION_SSH_PRIVATE_KEY` in GitHub.
4. After a successful deploy, remove the old public key line.
