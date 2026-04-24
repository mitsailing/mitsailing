# Production deploy runbook

This app ships as a **Docker image** on GitHub Container Registry (GHCR). Each
push to `main` builds and tags `ghcr.io/mitsailing/mitsailing:sha-<short>` and
`:latest`, then GitHub Actions SSHs to your Linux host and runs
`deploy <sha-short>` (see `bin/deploy.sh` and `.github/workflows/deploy.yml`).

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
| Directory `~/apps/mitsailing/` | Holds `compose.yaml`, `compose.prod.yaml`, `docker/postgres/init.sql`, `.env.production`, `deploy.sh` |

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
#   compose.yaml compose.prod.yaml docker/postgres/init.sql bin/deploy.sh
# Example from your workstation:
#   scp compose.yaml compose.prod.yaml YOUR_USER@YOUR_HOST:~/apps/mitsailing/
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
- `DATABASE_URL` — must match **Postgres in `compose.yaml`**: user `postgres`,
  database `dev_db`, host `postgres`, password `POSTGRES_PASSWORD`
- `POSTGRES_PASSWORD` — strong password; same value embedded in `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL=https://mitsailing.com` (or your real public URL)
- `CLOUDFLARE_TUNNEL_TOKEN` from the Cloudflare Zero Trust dashboard
- `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL` (real mail; there is no
  Mailpit in production)

**Cloudflare public hostname:** point your apex (e.g. `mitsailing.com`) to
`http://app:3000` on the tunnel. Production compose does **not** expose Mailpit.

### 4. GHCR pull authentication

```bash
# PAT needs read:packages for private images; public images may pull anonymously.
install -m 600 /dev/stdin ~/.ghcr-token <<'EOF'
ghp_your_token_here
EOF
docker login ghcr.io --username YOUR_GITHUB_USERNAME --password-stdin < ~/.ghcr-token
```

### 5. Lock down the deploy SSH key

Generate a **dedicated** key pair for GitHub Actions (not your personal key):

```bash
# On your workstation
ssh-keygen -t ed25519 -f ./mitsailing-deploy -C 'mitsailing gh actions deploy' -N ''
```

On the server, add the **public** key to `~/.ssh/authorized_keys` with a
`command=` restriction so that key can **only** run `deploy <ref>`. Use a
**literal absolute path** (OpenSSH does not expand `$HOME` here):

```
command="/home/YOUR_USER/deploy.sh $SSH_ORIGINAL_COMMAND",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc ssh-ed25519 AAAA...rest-of-public-key... comment
```

If `deploy.sh` lives elsewhere, change the path before `$SSH_ORIGINAL_COMMAND`.

Keep your **personal** SSH key in `authorized_keys` **without** `command=` so
you can still open a normal shell.

### 6. First bring-up (Postgres, then app)

Postgres must exist and be healthy before the app container runs migrations.

```bash
cd ~/apps/mitsailing

# First time only — creates the volume and runs init.sql
docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production up -d postgres

docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production ps
# Wait until postgres is healthy, then:

# Pin the same image tag CI will send (use `latest` or a concrete sha- tag from GHCR)
~/deploy.sh deploy latest
```

After the first successful deploy, day-to-day updates are **only** from GitHub
(`push` to `main` or **Actions → Deploy (production) → Run workflow**).

### 7. GitHub repository configuration

Create environment **`production`** (Settings → Environments) with URL
`https://mitsailing.com` if you like.

Add secrets used by `.github/workflows/deploy.yml`:

| Secret | Value |
| --- | --- |
| `PRODUCTION_SSH_USER` | Linux username (e.g. `deploy`) |
| `PRODUCTION_SSH_HOST` | Hostname or IP |
| `PRODUCTION_SSH_PRIVATE_KEY` | Full PEM of **mitsailing-deploy** private key |
| `PRODUCTION_SSH_HOST_KEY` | One line from `ssh-keyscan YOUR_HOST` |

---

## Day-to-day

- **Deploy:** merge to `main` (automatic) or run the Deploy workflow with a
  specific `ref` SHA for rollback.
- **Logs:**

  ```bash
  cd ~/apps/mitsailing
  docker compose -f compose.yaml -f compose.prod.yaml --env-file .env.production logs -f --tail 100 app
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
