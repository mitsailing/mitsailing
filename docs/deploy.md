# Production deploy runbook

This app ships as a **Docker image** on GitHub Container Registry (GHCR). Each
push to `main` builds and tags `ghcr.io/mitsailing/mitsailing:sha-<short>` and
`:latest`, then GitHub Actions SSHs to your Linux host to run
`release <sha-short>` (see `bin/deploy.sh` and `.github/workflows/deploy.yml`).

The server can run **rootless Docker** (no `sudo` for day-to-day). You only need
`sudo` once if your distro requires **loginctl linger** so the Docker user
daemon survives logout/reboot (see below).

Ingress in this repo is **Cloudflare Tunnel** (`cloudflared` in
`compose.prod.yaml`) so the host does not need inbound firewall ports for HTTP.

## Target production architecture

The target production topology is **two app hosts behind a proxy/load balancer**
(Cloudflare, a reverse proxy, or equivalent) plus **one Docker data/media
server**. The data/media server runs Postgres, Redis, the upload service, the
BullMQ worker, and static media nginx.

This gives zero-downtime app deployments and resilience to one app host going
away. It is **not** full data-tier high availability: Postgres, Redis, media
writes, media serving, and the upload service still depend on the single
data/media server.

Role split:

| Role | Runs |
| --- | --- |
| App host A / app host B | Next.js app containers behind the public proxy/load balancer |
| Data/media server | `postgres`, `redis`, upload service, `worker`, static media nginx |

Media storage is local to the data/media server. Do **not** add R2, S3, MinIO,
or another object store for this architecture. Uploaded media lives under:

```text
/srv/mitsailing-data/cms-media
```

Upload flow:

1. The browser asks an app host to create an upload session.
2. The browser uploads bytes directly to the data/media server upload service.
3. The app host finalizes the session and enqueues BullMQ processing.
4. The worker moves validated files into ready media paths under
   `/srv/mitsailing-data/cms-media`.
5. Static media nginx on the data/media server serves ready media.

The app hosts only create/finalize sessions and enqueue BullMQ work; upload
request bodies do not stream through the app hosts. That prevents app deploys
or app-host cutovers from interrupting active upload bodies.

Remaining upload limitation: the current direct PUT upload path is durable
across app-host deploys, but it is not resumable after a browser, client
network, or data/media-server upload connection interruption. Large uploads must
restart unless a resumable protocol is added later.

---

## What you need on the server

| Requirement | Notes |
| --- | --- |
| Docker Engine + Compose v2 | Rootless is fine; same user runs `docker compose` |
| SSH access | Interactive key for you; **separate** deploy key for CI |
| `docker login ghcr.io` | Once per user, PAT with `read:packages` if the image is private |
| Directory `~/apps/mitsailing/` | Holds `compose.yaml`, `compose.prod.yaml`, optional `compose.db-admin.yaml`, `docker/postgres/init.sql`, `.env.production`, `.deploy/`, `deploy.sh` |
| Directory `/srv/mitsailing-data/` | Host-owned production data root for Postgres, Redis, and CMS media bind mounts |

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
- `DATABASE_URL` — on app hosts, point this at the data/media server private
  IP or private DNS name. On the data/media server, use Compose host
  `postgres`. Production defaults to database name **`mitsailing_prod`**.
- `POSTGRES_PASSWORD` — strong password; same value embedded in `DATABASE_URL`
- `REDIS_URL` — on app hosts, point this at the data/media server private IP
  or private DNS name. On the data/media server, use `redis://redis:6379`.
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

**Cloudflare public hostname:** point your apex (e.g. `mitsailing.com`) to
`http://app:3000` on the tunnel. In production `app` is the internal nginx
proxy; `web_blue` and `web_green` are the real Next.js app containers.
Production compose does **not** expose Mailpit.

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
only the worker container:

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  --env-file .env.production --env-file .env.production.worker \
  up -d --force-recreate worker
```

The worker connects from `sailing-dock.mit.edu`. Confirm MySQL allows
`dock_readonly` from the production host or container network before setting
`LEGACY_MYSQL_SYNC_ENABLED=true`.

Connectivity check (uses both env files; password stays in the worker file):

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
sudo mkdir -p /srv/mitsailing-data/{postgres,redis,cms-media}
sudo chown -R DEPLOY_USER:DEPLOY_USER /srv/mitsailing-data
sudo chmod 700 /srv/mitsailing-data
sudo chmod 700 /srv/mitsailing-data/postgres
sudo chmod 700 /srv/mitsailing-data/redis
sudo chmod 700 /srv/mitsailing-data/cms-media
```

The data/media server requires `/srv/mitsailing-data` to exist and be writable
by the deploy user before `compose.prod.data.yaml` starts. Create the
`postgres`, `redis`, and `cms-media` subdirectories, then verify the running
containers use bind mounts at:

| Host path | Container path | Services |
| --- | --- | --- |
| `/srv/mitsailing-data/postgres` | `/var/lib/postgresql` | `postgres` |
| `/srv/mitsailing-data/redis` | `/data` | `redis` |
| `/srv/mitsailing-data/cms-media` | `/srv/mitsailing-data/cms-media` | `upload-service`, `worker`, `media` |

CMS media must be writable by the upload service and worker containers and
readable by the static media nginx container. App hosts do not mount this
folder.

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

```
no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA...rest-of-public-key... comment
```

If you keep the legacy single-host `bin/deploy.sh` path for another environment,
that environment can still use a forced-command deploy key. Do not reuse that
restricted key for the two-host controller.

Keep your **personal** SSH key in `authorized_keys` **without** `command=` so
you can still open a normal shell.

### 7. First bring-up (data/media server, app hosts, then release)

Postgres, Redis, the upload service, static media nginx, and the worker run on
the data/media server. Each app host runs the stateless `web` service from
`compose.prod.app-host.yaml`.

```bash
# On the data/media server
cd ~/apps/mitsailing
docker compose -f compose.prod.data.yaml \
  --env-file .env.production.data --env-file .env.production.worker \
  up -d postgres redis upload-service media worker

# On each app host
cd ~/apps/mitsailing
printf 'false\n' > .deploy/traffic-enabled
APP_IMAGE=ghcr.io/mitsailing/mitsailing:latest docker compose \
  -f compose.prod.app-host.yaml \
  --env-file .env.production.app-host up -d web
```

After the containers are healthy, run the first release from CI or an operator
machine that can SSH to all three hosts:

```bash
APP_HOST_BLUE=deploy@app-blue.example \
APP_HOST_GREEN=deploy@app-green.example \
DATA_MEDIA_HOST=deploy@app-data.example \
bin/deploy-two-host.sh release latest
```

After the first successful deploy, day-to-day updates are **only** from GitHub
(`push` to `main` or **Actions → Deploy (production) → Run workflow**).

Release jobs **scp** `compose.prod.app-host.yaml`, `compose.prod.data.yaml`,
`docker/postgres/init.sql`, and `docker/nginx/media.conf` to each production
host on every run so production Docker shape stays aligned with the branch.

Production releases are host-level blue/green. The release command writes
`.env.image` on both app hosts and the data/media server, runs Prisma migrations
once from the data/media server image, recreates the data/media worker, checks
the inactive app host with `/api/health/ready?mode=service`, flips the inactive
host’s `.deploy/traffic-enabled` file to `true`, waits for public readiness,
then drains the previous app host by writing `false` to its traffic file. Keep
migrations backward-compatible across at least one release: add before using,
avoid same-release destructive drops/renames, and remove old columns only after
deployed code no longer reads them.

Expand/contract checklist (for schema changes):
- Add new columns/tables/enums values in the first migration; backfill as needed.
- Deploy code that can read the old schema and the expanded schema.
- Only after the next release (when all instances are on the new code): contract
  (drop/rename old columns, remove legacy enum labels, etc.).

Health readiness (`/api/health/ready`) checks Postgres, Redis, the data/media
upload service, static media nginx, and the host traffic gate. `mode=service`
skips only the traffic gate so deploy automation can validate an inactive host
before it receives public traffic. Make sure Postgres `max_connections`
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
| `PRODUCTION_APP_HOST_BLUE` | SSH target for the blue app host, e.g. `deploy@app-blue.example` |
| `PRODUCTION_APP_HOST_GREEN` | SSH target for the green app host, e.g. `deploy@app-green.example` |
| `PRODUCTION_DATA_MEDIA_HOST` | SSH target for the data/media server, e.g. `deploy@app-data.example` |
| `PRODUCTION_SSH_PRIVATE_KEY` | Full PEM of **mitsailing-deploy** private key |
| `PRODUCTION_SSH_HOST_KEY` | One or more pinned lines from `ssh-keyscan` for all three production hosts |

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
  ssh deployer@sailing-dock.mit.edu '~/deploy.sh rollback previous'
  ```

- **Rollback app/worker to an explicit image tag:**

  ```bash
  ssh deployer@sailing-dock.mit.edu '~/deploy.sh rollback sha-abc123def456'
  ```

  Blue/green rollback or switching traffic back to the other app host can
  recover app code quickly. It cannot undo already-applied DB migrations,
  deleted media, data corruption, or non-backward-compatible schema changes.

- **Logs:**

  ```bash
  cd ~/apps/mitsailing
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 app web_blue web_green
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 worker
  ```

- **Status:**

  ```bash
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production ps
  ```

## Operations checklist

- **Deploy:** confirm both app hosts can reach Postgres, Redis, the upload
  service, and media nginx on the data/media server; deploy the inactive
  app host first; wait for readiness; switch proxy/load-balancer traffic; then
  update the other app host.
- **Rollback:** switch proxy/load-balancer traffic back to the previous healthy
  app host or previous blue/green color; do not assume rollback reverses
  migrations, media deletes, data corruption, or incompatible schema changes.
- **File permissions:** keep `/srv/mitsailing-data` and subdirectories owned by
  the deploy/runtime user expected by Docker; verify `cms-media` is writable by
  the upload service and worker, and readable by static media nginx.
- **Postgres:** keep it on the data/media server; verify health before app
  cutover; keep migrations backward-compatible across at least one release; back
  up before risky schema changes.
- **Redis:** keep append-only persistence enabled; verify worker connectivity
  and BullMQ queues after deploy; remember cron scheduling requires
  `LEGACY_MYSQL_SYNC_ENABLED=true`.
- **Media storage:** store uploads only in `/srv/mitsailing-data/cms-media`; do
  not configure R2, S3, or MinIO; verify direct browser uploads hit the
  data/media server upload service, not an app host.
- **Backups:** back up Postgres, Redis persistence if needed for queue recovery,
  and `/srv/mitsailing-data/cms-media`; test restores before relying on the
  backup procedure.

## Post-push PR verification loop

After this branch is pushed and a PR exists, hand off PR completion to a fresh
subagent using the installed `finish-pr-context7` skill at
`/Users/andrewkelley/.codex/skills/finish-pr-context7/SKILL.md`. Do not run the
loop in the implementation-planning session.

The subagent should:

- Resolve the PR with GitHub/`gh`.
- Inspect failing checks first.
- Fix checks before reading or addressing review comments.
- Only after checks have no failures, fetch unresolved actionable PR review
  comments.
- Use Context7 exactly as the skill requires for each library, framework, SDK,
  CLI, or API fix cluster.
- Run `npm run check:types`, `npm run lint`, and `npm run test`; also run
  `npm run check:i18n` when copy or translation keys change.
- Commit and push follow-up fixes with Conventional Commit messages.
- Poll or schedule a heartbeat if required checks are pending.
- Stop only when required checks pass and no unresolved actionable comments
  remain, or when only documented non-actionable items remain.

---

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
