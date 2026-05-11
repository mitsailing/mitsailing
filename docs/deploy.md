# Production deploy runbook

This app ships as a **Docker image** on GitHub Container Registry (GHCR). Each
push to `main` builds and tags `ghcr.io/mitsailing/mitsailing:sha-<short>` and
`:latest`, then GitHub Actions SSHs to your Linux host to run
`migrate <sha-short>` followed by `deploy <sha-short>` (see `bin/deploy.sh`
and `.github/workflows/deploy.yml`).

The server can run **rootless Docker** (no `sudo` for day-to-day). You only need
`sudo` once if your distro requires **loginctl linger** so the Docker user
daemon survives logout/reboot (see below).

Ingress in this repo is **Cloudflare Tunnel** (`cloudflared` in
`compose.prod.yaml`) so the host does not need inbound firewall ports for HTTP.

---

## What you need on the server

| Requirement | Notes |
| --- | --- |
| Docker Engine + Compose v2 | Rootless is fine; same user runs `docker compose` |
| SSH access | Interactive key for you; **separate** deploy key for CI |
| `docker login ghcr.io` | Once per user, PAT with `read:packages` if the image is private |
| Directory `~/apps/mitsailing/` | Holds `compose.yaml`, `compose.prod.yaml`, optional `compose.db-admin.yaml`, `docker/postgres/init.sql`, `.env.production`, `deploy.sh` |

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
mkdir -p ~/apps/mitsailing/docker/postgres
cd ~/apps/mitsailing

# From a clone of this repo on your laptop, scp or cp:
#   compose.yaml compose.prod.yaml compose.db-admin.yaml docker/postgres/init.sql bin/deploy.sh
# Example from your workstation:
#   scp compose.yaml compose.prod.yaml compose.db-admin.yaml YOUR_USER@YOUR_HOST:~/apps/mitsailing/
#   scp docker/postgres/init.sql YOUR_USER@YOUR_HOST:~/apps/mitsailing/docker/postgres/
#   scp bin/deploy.sh YOUR_USER@YOUR_HOST:~/deploy.sh

chmod +x ~/deploy.sh
```

`bin/deploy.sh` defaults to `DEPLOY_DIR=$HOME/apps/mitsailing`. If you use a
different path, set `DEPLOY_DIR` in the `authorized_keys` line (see below) or
edit the script.

### 3. Configure `.env.production`

```bash
cd ~/apps/mitsailing
cp /path/to/repo/.env.production.example .env.production
$EDITOR .env.production
```

Fill at least:

- `BETTER_AUTH_SECRET` (32+ random chars)
- `DATABASE_URL` — must match Postgres in Compose: user `postgres`, host
  `postgres`, password `POSTGRES_PASSWORD`. Production defaults to database
  name **`mitsailing_prod`** (`compose.prod.yaml`). If your volume was created
  earlier with `dev_db`, keep `POSTGRES_DB=dev_db` and point `DATABASE_URL` at
  `dev_db` until you migrate.
- `POSTGRES_PASSWORD` — strong password; same value embedded in `DATABASE_URL`
- `REDIS_URL` — e.g. `redis://redis:6379` for the BullMQ **worker** service
  (`compose.yaml` / `compose.prod.yaml`)
- Optional **`DEPLOYMENT_VERSION`** — same string on every `app` container when
  using rolling deploys or multiple replicas (wired to Next.js `deploymentId`;
  image tag or git SHA is typical).
- Optional **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** — required before running
  **more than one** `app` replica or overlapping rolling deploys (see Next.js
  data security docs).
- `NEXT_PUBLIC_APP_URL=https://mitsailing.com` — must match the URL baked
  into the image by GitHub Actions (`deploy.yml` `build-arg`); the production
  host’s `.env.production` should use the **same** value for runtime `Env`
  (the host file is **not** read during the CI image build).
- `CLOUDFLARE_TUNNEL_TOKEN` from the Cloudflare Zero Trust dashboard
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
`http://app:3000` on the tunnel. Production compose does **not** expose Mailpit.

### 4. Create the production CMS media volume

Production uploads live in the external Docker volume
`mitsailing_cms_media`, mounted inside both `app` and `worker` at
`/var/lib/mitsailing/cms-media`. The deploy script creates the volume if it is
missing, but creating it explicitly during bootstrap makes the persistence
contract visible before the first deploy:

```bash
docker volume inspect mitsailing_cms_media >/dev/null 2>&1 || docker volume create mitsailing_cms_media
```

Back up uploaded media by archiving the volume contents from a temporary
container:

```bash
backup_file="mitsailing-cms-media-backup-$(date -u +%Y%m%dT%H%M%SZ).tgz"
docker run --rm \
  -v mitsailing_cms_media:/media:ro \
  -v "$PWD":/backup \
  alpine tar czf "/backup/${backup_file}" -C /media .
```

Restore into the same external volume before starting app containers:

```bash
backup_file="$(ls -t mitsailing-cms-media-backup-*.tgz | head -n 1)"
if [ -z "$backup_file" ] || [ ! -f "$backup_file" ]; then
  echo "No backup file found matching mitsailing-cms-media-backup-*.tgz" >&2
  exit 1
fi
docker run --rm \
  -v mitsailing_cms_media:/media \
  -v "$PWD":/backup \
  -e BACKUP_FILE="$backup_file" \
  alpine sh -c 'cd /media && tar xzf "/backup/${BACKUP_FILE}"'
```

Do **not** use `docker compose down -v` on the production stack unless you have
a current, verified media backup and intend to delete all uploaded CMS media.

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

On the server, add the **public** key to `~/.ssh/authorized_keys` with a
`command=` restriction so that key can only run this script's
`migrate <ref>` / `deploy <ref>` commands. Use a
**literal absolute path** (OpenSSH does not expand `$HOME` here):

```
command="/home/YOUR_USER/deploy.sh $SSH_ORIGINAL_COMMAND",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA...rest-of-public-key... comment
```

If `deploy.sh` lives elsewhere, change the path before `$SSH_ORIGINAL_COMMAND`.

Keep your **personal** SSH key in `authorized_keys` **without** `command=` so
you can still open a normal shell.

### 7. First bring-up (Postgres + Redis, then migrate + app/worker)

Postgres and Redis must exist and be healthy before the app and worker
containers start.

```bash
cd ~/apps/mitsailing

# First time only — creates data volumes and runs init.sql
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production up -d postgres redis

docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production ps
# Wait until postgres and redis are healthy, then:

# Pin the same image tag CI will send (use `latest` or a concrete sha- tag from GHCR)
~/deploy.sh migrate latest
~/deploy.sh deploy latest
```

After the first successful deploy, day-to-day updates are **only** from GitHub
(`push` to `main` or **Actions → Deploy (production) → Run workflow**).

Migrate and deploy jobs **scp** `compose.yaml` and `compose.prod.yaml` to
`~/apps/mitsailing/` on each run so production Compose overlays (for example
worker healthchecks) stay aligned with the branch, not only whatever was copied
at initial bootstrap.

### 8. GitHub repository configuration

Create environment **`production`** (Settings → Environments) with URL
`https://mitsailing.com` if you like. Add **Required reviewers** on that
environment so production deploys wait for explicit approval (recommended).

Add secrets used by `.github/workflows/deploy.yml`:

| Secret | Value |
| --- | --- |
| `PRODUCTION_SSH_USER` | Linux username (e.g. `deploy`) |
| `PRODUCTION_SSH_HOST` | Hostname or IP |
| `PRODUCTION_SSH_PRIVATE_KEY` | Full PEM of **mitsailing-deploy** private key |
| `PRODUCTION_SSH_HOST_KEY` | One line from `ssh-keyscan YOUR_HOST` |

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

## Database admin access (SSH tunnel)

Production Postgres is **not** published on the host by default. For one-off
access from your laptop (GUI or `psql`), use **your personal SSH key** (not the
CI deploy key) and optionally add the **`compose.db-admin.yaml`** overlay so
Postgres listens on loopback only:

```bash
cd ~/apps/mitsailing
docker compose -f compose.yaml -f compose.prod.yaml -f compose.db-admin.yaml --env-file .env.production up -d
```

Then tunnel:

```bash
ssh -N -L 15432:127.0.0.1:15432 YOUR_USER@SERVER
```

Point tools at `127.0.0.1:15432` (see `compose.db-admin.yaml` for the default
port). When finished, remove the admin overlay so the port is not left open.

More context: [docs/devops_plan.md](./devops_plan.md) §5.5.

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
- **Logs:**

  ```bash
  cd ~/apps/mitsailing
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 app
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 worker
  ```

- **Status:**

  ```bash
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production ps
  ```

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
