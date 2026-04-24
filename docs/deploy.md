# Staging deploy runbook

Target: `mitsailing.com`, hosted on `sailing-dock.mit.edu` under the `ak`
user account with rootless Docker. Ingress is a Cloudflare Tunnel; the
server itself exposes no inbound ports to the public internet.

CI builds a Docker image from every push to `main`, pushes it to GitHub
Container Registry (GHCR) as `ghcr.io/mitsailing/mitsailing:staging`
plus an immutable `sha-<shortsha>` tag, then connects over SSH to trigger
`bin/deploy.sh` on the server.

---

## One-time setup

These steps only happen once per server. Split by who does them.

### Admin (needs sudo)

Just two lines. Everything else runs as `ak`.

1. **Enable rootless-docker autostart** so the Docker daemon survives
   reboots without a login session:

   ```bash
   sudo loginctl enable-linger ak
   ```

   This flips `ak`'s `systemd --user` scope to "lingering", which is what
   keeps `docker.service` (user scope) alive after the admin and `ak`
   both log out.

2. **Confirm Docker is installed and rootless-Docker is set up for `ak`.**
   If `dockerd-rootless-setuptool.sh install` has never run for `ak`, ask
   the admin to run it once (it needs `newuidmap` / `newgidmap`, which
   may need a one-time `apt install uidmap` depending on distro).

That's the full admin ask. No firewall changes, no reverse proxy, no
systemd units for the app itself — Docker handles that.

### ak (no sudo required)

1. **Bootstrap Cloudflare Tunnel.**
   In the Cloudflare Zero Trust dashboard:
   - Create a tunnel named `sailing-dock-staging`.
   - Add two public hostnames:
     - `mitsailing.com` → `http://app:3000`
     - `mail.mitsailing.com` → `http://mailpit:8025`
   - Copy the tunnel token; it starts with `eyJ`. You'll paste it into
     `.env.staging` as `CLOUDFLARE_TUNNEL_TOKEN`.

2. **Prepare the deploy directory.**

   ```bash
   mkdir -p ~/apps/mitsailing
   cd ~/apps/mitsailing

   # Pull the compose + deploy.sh files. You can either clone the repo
   # and `cp` them over, or scp them in once — they don't change often.
   cp /path/to/repo/compose.yaml .
   cp /path/to/repo/compose.staging.yaml .
   cp /path/to/repo/docker/postgres/init.sql docker/postgres/init.sql  # mkdir -p first
   cp /path/to/repo/bin/deploy.sh ~/deploy.sh
   chmod +x ~/deploy.sh

   # Fill in real values (tunnel token, GHCR image path, DB password,
   # bcrypt-hashed Mailpit UI credentials).
   cp /path/to/repo/.env.staging.example .env.staging
   $EDITOR .env.staging
   ```

3. **Generate the Mailpit UI basic-auth credential.** It's a bcrypt hash
   of `username:password`:

   ```bash
   docker run --rm httpd:alpine htpasswd -nbB mit 'YOUR-STRONG-PASSWORD'
   ```

   Quote the full `user:$2y$05$...` output and paste it as
   `MAILPIT_UI_AUTH=...` in `.env.staging`. Mail UI will be at
   `https://mail.mitsailing.com` once the tunnel is live.

4. **Pin the deploy key to the deploy command.** Put this line in
   `~/.ssh/authorized_keys` (alongside whatever admin key you already
   have) — replace `<GH_ACTIONS_DEPLOY_PUBLIC_KEY>` with the public half
   of the key you'll give GitHub:

   ```
   command="/home/ak/deploy.sh ${SSH_ORIGINAL_COMMAND}",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc <GH_ACTIONS_DEPLOY_PUBLIC_KEY>
   ```

   This is the only line that matters for security — any invocation of
   that key can do exactly `deploy <tag>` and nothing else. A leaked key
   cannot drop a shell or exfiltrate files.

5. **Log in to GHCR so the first pull succeeds:**

   ```bash
   # Create a PAT with `read:packages`; store it in ~/.ghcr-token with mode 600.
   docker login ghcr.io --username <your-github-username> --password-stdin < ~/.ghcr-token
   ```

6. **First bring-up:**

   ```bash
   cd ~/apps/mitsailing
   docker compose -f compose.yaml -f compose.staging.yaml --env-file .env.staging up -d postgres
   # Wait for postgres to be healthy, then let deploy.sh start app + mailpit:
   ~/deploy.sh deploy staging
   ```

### GitHub repo admin

Add these secrets under **Settings → Environments → staging**:

| Secret | Value |
| --- | --- |
| `STAGING_SSH_USER` | `ak` |
| `STAGING_SSH_HOST` | `sailing-dock.mit.edu` |
| `STAGING_SSH_PRIVATE_KEY` | Private half of the deploy key pair |
| `STAGING_SSH_HOST_KEY` | Output of `ssh-keyscan sailing-dock.mit.edu` (paste the `ssh-rsa ...` or `ssh-ed25519 ...` line) |

Enable "Required reviewers" on the `staging` environment if you want a
human approval gate; otherwise pushes to `main` deploy automatically.

---

## Day-to-day

- **Trigger a deploy**: push to `main` (automatic) or use
  **Actions → Deploy (staging) → Run workflow** to deploy a specific ref.
- **Rollback**: in the GitHub UI, run Deploy (staging) with input
  `ref=<older-sha>` — the resulting image tag (`sha-<short>`) will be
  re-pinned by `deploy.sh`.
- **Inspect state on the server**:
  ```bash
  ssh ak@sailing-dock.mit.edu
  cd ~/apps/mitsailing
  docker compose -f compose.yaml -f compose.staging.yaml ps
  docker compose -f compose.yaml -f compose.staging.yaml logs --tail 100 app
  ```
  (When SSH'ing interactively you'll want a second authorized key without
  the `command=` restriction — admin keys typically.)
- **Read email in staging**: visit `https://mail.mitsailing.com` and
  enter the basic-auth credentials from step 3 above.

## Key rotation

Deploy keys rotate every 12 months, or immediately on suspected
compromise:

1. On your workstation: `ssh-keygen -t ed25519 -f /tmp/deploy-new -C 'gh-actions deploy'`
2. On the server: append the new public key to
   `~/.ssh/authorized_keys` with the same `command=...` restriction.
3. Update `STAGING_SSH_PRIVATE_KEY` in GitHub secrets.
4. After the next successful deploy, delete the old public key line.

Compose and `.env.staging` rarely change; when they do, `scp` them
in and re-run `~/deploy.sh deploy <currenttag>`.
