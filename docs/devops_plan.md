# DevOps plan — self-hosted Docker (rootless), Postgres, jobs, backups

This document is the operational target for **mitsailing** on a **shared Linux host** with **rootless Docker**, **Cloudflare Tunnel** ingress, and **GitHub Actions** as the deploy path. It complements the concrete runbook in [`deploy.md`](./deploy.md).

---

## 1. Goals and constraints

| Area | Decision |
| --- | --- |
| Docker | **Rootless** Engine + Compose v2; day-to-day deploy user has **no sudo**. |
| Ingress | **Cloudflare Tunnel** to `app` (and other internal services via additional hostnames). No requirement to open inbound HTTP(S) on the host firewall for the app. |
| SSH | Dedicated IP allows **operator SSH**; CI uses a **restricted deploy key** (`command=` → `deploy.sh` only) as already documented. |
| Co-tenancy | **Other apps** on the same machine — isolate with **distinct Compose project names**, **user-defined bridge networks**, **non-overlapping named volumes**, and **resource limits**. |
| Database | **Single Postgres container** per environment; **not published** to host ports in steady state. |
| RPO / retention | **15 minutes** maximum acceptable data loss for backups; **7 days** retention in object storage. |
| Off-site backup | **AWS S3** with **server-side encryption** (SSE-S3 or SSE-KMS) and tight IAM. |
| Compliance posture | **No SOC 2** program required here; still enforce **encryption at rest** (S3, disk where possible), **encryption in transit** (HTTPS via Cloudflare, TLS to Cloudflare), and **ADA** as an **application** concern (WCAG 2.x audits, semantic HTML, keyboard paths) — not a Docker feature. |
| Staging VM | **None for now**; **preview deployments per PR** are desired (own DB, optional worker stack, preview URL). |

---

## 2. Architecture (target)

```text
                    Cloudflare Edge
                           │
                    cloudflared (container)
                     /    |     \
                    /     |      \
              app:3000  bull-board  grafana (examples)
                   \    |     /
                    \   |    /
                 internal Docker bridge
              ┌────┴────┬──────────┬────────┐
              │ app     │ worker   │ redis  │
              │ (Next)  │ (BullMQ) │        │
              └────┬────┴────┬─────┴────────┘
                   │         │
                 postgres (no host ports)
```

- **App**: existing Next.js standalone image (`compose.prod.yaml` pattern).
- **Worker**: separate service, **same image** (or slim variant), different `command` — runs BullMQ processors and scheduled jobs (see §7).
- **Redis**: job broker + short-lived dedupe keys; **not** exposed to the internet; optional Redis ACL password in env.
- **Postgres**: one instance per “stack” (production vs each PR preview stack); data in **named volume** only.

---

## 3. Next.js — caching & self-hosting (official docs alignment)

This stack uses **Next.js 16** with `output: 'standalone'` and a **single `app` container** today. The following gaps and recommendations come from Next’s **self-hosting** and **caching** documentation (as published on [nextjs.org](https://nextjs.org/docs) — treat links as the source of truth when versions drift).

| Topic | What the official docs say | Plan / gap |
| --- | --- | --- |
| **Default Data Cache location** | ISR, prerendered data, and related cache use the **same server cache**, stored on **local filesystem** by default; a **single** `next start` instance with **persistent disk** “works automatically.” | **Met today** if the `app` container keeps a **stable writable** `.next` cache (named volume or writable layer — evaluate after enabling ISR/`use cache` heavily). |
| **Multiple app replicas** | Ephemeral disks or **more than one** Next instance → caches diverge; stale HTML/data until each instance sees invalidation. | **Not in scope** until you scale `app` horizontally; then implement a **custom cache handler** ([`incrementalCacheHandlerPath`](https://nextjs.org/docs/app/api-reference/config/next-config-js/incrementalCacheHandlerPath)) and/or [`cacheHandlers`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheHandlers) backed by **shared storage** (Redis/S3). Official example: [`cache-handler-redis`](https://github.com/vercel/next.js/tree/canary/examples/cache-handler-redis). |
| **`revalidateTag` across instances** | `revalidateTag` on one instance does not clear others until you coordinate. | With multiple replicas, implement **`refreshTags()`** in the custom cache handler so each instance syncs tag state before requests ([multi-instance coordination](https://nextjs.org/docs/app/guides/self-hosting#multi-instance-cache-coordination), [How revalidation works](https://nextjs.org/docs/app/guides/how-revalidation-works)). |
| **Cache Components (`cacheComponents`)** | Next 16 can enable [`cacheComponents: true`](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents) and the [`use cache`](https://nextjs.org/docs/app/api-reference/directives/use-cache) model with [`cacheLife`](https://nextjs.org/docs/app/api-reference/functions/cacheLife) / tag APIs. | **Decide explicitly**: either adopt Cache Components per [Caching (`use cache`)](https://nextjs.org/docs/app/getting-started/caching) **or** stay on the previous model per [Caching without Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components). The DevOps plan does not pick the app model — but **infra** must match (shared handler if multiple replicas or [`use cache: remote`](https://nextjs.org/docs/app/api-reference/directives/use-cache-remote)). |
| **`fetch` caching** | In the **previous** model, `fetch` is **not cached by default**; opt in with `cache: 'force-cache'` or `next: { revalidate, tags }`. | Application work: audit `fetch` calls and route [`dynamic`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic) / [`revalidate`](https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#revalidate) exports. |
| **Server Actions encryption** | Multi-instance: set **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** (AES-length base64) so every instance shares the same key ([Data Security](https://nextjs.org/docs/app/guides/data-security#overwriting-encryption-keys-advanced)). | **Add to production secrets** before running **>1** `app` replica or overlapping rolling deploy with mixed versions. |
| **Version skew / rolling deploys** | Configure [`deploymentId`](https://nextjs.org/docs/app/api-reference/config/next-config-js/deploymentId) (e.g. from `DEPLOYMENT_VERSION` / image tag) so clients hard-reload when build mismatches ([Self-hosting: Version skew](https://nextjs.org/docs/app/guides/self-hosting#version-skew)). | **Recommended** once deploys are frequent or you run multiple replicas; align `deploymentId` with the **same** value baked at build or injected at runtime per Next’s guidance. |
| **Consistent `generateBuildId`** | If different stages rebuild separately, set [`generateBuildId`](https://nextjs.org/docs/app/api-reference/config/next-config-js/generateBuildId) (e.g. git SHA) so all containers serve one build. | **Already aligned** if CI builds **one** image and all containers pull that digest; document if you ever split build stages. |
| **Reverse proxy** | Docs recommend a **reverse proxy** in front of `next start` for malformed requests, slow connections, body limits, rate limiting ([Self-hosting: Reverse Proxy](https://nextjs.org/docs/app/guides/self-hosting#reverse-proxy)). | **Partially met**: **Cloudflare** + tunnel terminates client TLS and adds edge protections; **cloudflared → app** is still “direct” to Node — acceptable for many teams; tighten **body size / timeouts** in app or add an inner nginx only if threat model requires it. |
| **Streaming / buffering** | Proxies must **not buffer** streaming responses (nginx `X-Accel-Buffering: no` pattern in docs; HTTP/2 streaming support). | **Validate** Cloudflare + tunnel path for **Suspense / PPR** streams; if responses buffer, TTFB suffers. See [Streaming and Suspense](https://nextjs.org/docs/app/guides/self-hosting#streaming-and-suspense) and [PPR platform guide](https://nextjs.org/docs/app/guides/ppr-platform-guide). |
| **Graceful shutdown** | On stop, send **SIGINT/SIGTERM** and allow a **drain** window (docs suggest **10–30s**) so in-flight requests and [`after()`](https://nextjs.org/docs/app/api-reference/functions/after) callbacks finish ([Self-hosting — graceful shutdown](https://nextjs.org/docs/app/guides/self-hosting)). | Set Compose **`stop_grace_period: 30s`** (or similar) on `app`; ensure orchestration **waits** for container exit before SIGKILL. |
| **Image Optimization** | `next/image` runs at **runtime** with `next start`; optional `loader`; [`minimumCacheTTL`](https://nextjs.org/docs/app/api-reference/components/image#minimumcachettl); glibc systems may need [**sharp** allocator tuning](https://nextjs.org/docs/app/guides/self-hosting#image-optimization) per upstream. | **Alpine** prod image: watch **memory** under image optimization load; adjust `images.minimumCacheTTL` / device sizes as needed. |
| **Environment variables** | `NEXT_PUBLIC_*` inlined at **build**; server secrets at **runtime** — use [`connection()`](https://nextjs.org/docs/app/api-reference/functions/connection) when relying on runtime env in dynamic paths ([Self-hosting: Environment Variables](https://nextjs.org/docs/app/guides/self-hosting#environment-variables)). | **Already reflected** in Dockerfile placeholders vs runtime `env_file`; keep documenting which vars require **rebuild** vs **restart**. |
| **CDN caching** | If you later put a CDN in front of the origin, follow [CDN caching](https://nextjs.org/docs/app/guides/cdn-caching) for `Cache-Control` / variants. | **Optional** with Cloudflare; tune page rules / cache rules so **dynamic** HTML is not cached incorrectly. |

**Optional consolidation:** the same **Redis** proposed for BullMQ (§7) can back a **Next custom cache handler** with strict **key namespaces** — only if you need shared or durable Data Cache; do not share one logical DB index with job payloads without a design review.

---

## 4. Resource limits (defaults to fill in)

Rootless cgroups v2 fully supports `deploy.resources`. Use these as **starting caps**; adjust after observing `docker stats` under real load. Replace `___` with numbers appropriate for your host **after** reserving capacity for co-tenant apps.

| Service | `cpus` (Compose) | `memory` | Notes |
| --- | --- | --- | --- |
| `app` | `___` | `___` | Next.js SSR + API; raise if CPU-bound during traffic spikes. |
| `worker` | `___` | `___` | Often similar to `app` if jobs are heavy; can be lower if mostly I/O. |
| `postgres` | `___` | `___` | Add headroom for `pg_dump` if backup runs **inside** the container; otherwise run backup from a sidecar or host cron calling `docker exec`. |
| `redis` | `___` | `___` | Keep memory strict; use `maxmemory` + eviction policy in `redis.conf` or command flags. |
| `cloudflared` | `___` | `___` | Usually small; raise if many tunnels or high throughput. |

Example fragment (values illustrative — **replace** before production):

```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 1536M
    reservations:
      cpus: '0.25'
      memory: 512M
```

**Co-tenancy rule of thumb**: sum **limits** across **all** Compose stacks on the host should stay **below** ~85% of allocatable CPU/RAM so the kernel and other tenants remain stable.

---

## 5. Postgres: naming, network exposure, and encryption

### 5.1 Where Postgres runs (same Compose vs separate stack vs no Docker)

| Approach | When to use | For this project |
| --- | --- | --- |
| **Postgres in the same Compose project as the app** (`compose.yaml` + `compose.prod.yaml`, official image) | Default for small/medium self-hosted apps: one network, `depends_on` healthchecks, `DATABASE_URL=...@postgres:5432/...`, backups via `docker exec`. | **Recommended default** — matches [`deploy.md`](./deploy.md) and keeps migrations (`prisma migrate deploy` in the app container) simple. The `deploy:` `resources` snippet (§4) applies per **service**; Postgres is just another service with its own limits. |
| **Postgres in a separate Compose project** (e.g. `mitsailing-db/compose.yaml`, own `name:` and volumes) | You want **independent lifecycle** (upgrade/restart app without touching DB), stricter blast radius, or a DBA-owned stack while the app team owns app compose. | Valid **upgrade path** on a busy shared host; you must still put app and DB on a **shared user-defined network** (or expose Postgres only on `127.0.0.1` + tunnel) and point `DATABASE_URL` at the DB container hostname. Slightly more moving parts. |
| **Postgres installed on the host (no Docker)** (`apt`/distro packages) | Org policy, dedicated DB tuning, or a **dedicated database machine** where Docker is not used for data plane. | **Not the first choice** here: install/upgrade usually needs **sudo**, backups/patching are a second toolchain, and you lose the “everything the deploy user can reproduce from compose files” story. Consider only if Postgres moves to **another VM** or cloud RDS/Aurora. |

There is **no separate Dockerfile required** for Postgres unless you need custom extensions baked in; the upstream **`postgres:<version>-alpine`** image (as in `compose.yaml`) is the norm. A “separate docker file” for the database is only useful for **custom images** (extensions, hardened config); otherwise use **env + mounted config** or `command:` overrides.

### 5.2 Logical database name

Today `compose.yaml` uses `POSTGRES_DB: dev_db`. For production clarity (and to reduce operator error), **rename the production database** to something explicit (e.g. `mitsailing_prod`) in a production-only override or env-driven `POSTGRES_DB`, and align `DATABASE_URL`. Keeping the name `dev_db` in production is a recurring foot-gun.

### 5.3 Not reachable from outside Docker

- Do **not** publish `5432` on the host for production.
- Keep Postgres on the **default bridge for the compose project** or a **named network** shared only by `app`, `worker`, and migration jobs.

### 5.4 TLS *inside* the Docker network

- **Pragmatic default**: app ↔ Postgres on the private bridge **without** Postgres TLS is common *if* the host boundary is trusted and **no** untrusted workload shares the **same** network namespace as Postgres.
- **Stronger default (recommended for multi-tenant hosts)**: enable **Postgres SSL** with certificates mounted read-only into the Postgres container, and use `sslmode=require` in `DATABASE_URL`. Rotate certs on the same cadence as the host reboot cycle or annually.

### 5.5 Database access when needed (tunnel)

Pick **one** pattern and document it in the team runbook. See
[deploy.md](./deploy.md#database-admin-access).

**Option A — SSH TCP forward (operator laptop → DB)**  
Requires SSH with a **normal shell** (personal key), **not** the CI `command=` deploy key.

1. **On the server**, expose Postgres on **localhost only** for the session — never bind `0.0.0.0`. On `sailing-dock.mit.edu`, use the ephemeral socat sidecar in [`.cursor/skills/pgsync-prod-to-local/SKILL.md`](../.cursor/skills/pgsync-prod-to-local/SKILL.md) (step 1).

2. **On your laptop**:

```bash
ssh -N -L 15432:127.0.0.1:15432 youruser@SERVER_IP
```

3. Point tools at local port **15432**:

```text
postgresql://USER:PASS@127.0.0.1:15432/DBNAME?sslmode=require
```

4. When finished, tear down the server-side forward and end the SSH session so **15432** is closed.

**Option B — Cloudflare Tunnel private TCP**  
Cloudflare Zero Trust can expose a **private TCP** route to `postgres:5432` for authenticated team members. Useful if SSH port forwarding is undesirable. **Still** require strong auth (Cloudflare Access + short-lived credentials).

**Never** expose raw Postgres to the public internet.

---

## 6. Backups and restore (enterprise-minded, minimal moving parts)

### 6.1 Objective

| Metric | Target |
| --- | --- |
| RPO | ≤ **15 minutes** |
| Retention | **7 days** in S3 |
| Encryption | SSE-S3 or SSE-KMS; optional **client-side** encrypt (`age` or GPG) before upload for defense-in-depth |

### 6.2 Method

- **Logical backups**: `pg_dump` (or `pg_dump -Fc` custom format) on a schedule **every 10–15 minutes** via:
  - a small **sidecar** service in Compose, **or**
  - **user cron** on the host invoking `docker exec` against the running Postgres container.
- **Upload**: `aws s3 cp` with a dedicated IAM user or instance role; prefix by date/hour, e.g. `s3://bucket/mitsailing-prod/pgdump/YYYY/MM/DD/HHMM.dump`.
- **Lifecycle**: S3 lifecycle rule to expire objects after **7 days**.
- **Integrity**: weekly automated `pg_restore --list` (or restore to a throwaway DB) in CI or a scheduled job.

### 6.3 Secrets for backup

Store **AWS access** for backup in the **deploy user’s** environment file only if no better vault exists; prefer **IRSA/instance profile** if this VM is on AWS EC2. If the server is bare metal, use a **scoped IAM user** with **PutObject** only to the backup prefix.

### 6.4 Restore runbook (summary)

1. Stop `app` and `worker` (avoid writes during restore) **or** restore to a new volume and swap.
2. Restore from latest good dump into Postgres.
3. Run migration sanity check (`prisma migrate status`) and bring services up.

---

## 7. Background jobs (recommendation)

### 7.1 Stack

**Recommended**: **Redis + BullMQ** (or BullMQ-compatible) with a **dedicated `worker` service** in Compose:

- Same codebase / same image as the app; `command` runs a Node entry (e.g. `node dist/worker.js` or `tsx` in dev).
- **Bull Board** (queue UI) **only** behind **Cloudflare Access** (or Basic Auth + allowlist) on a **subdomain** routed through the same tunnel (e.g. `bull.mitsailing.com`).

### 7.2 Your stated workloads

| Workload | Pattern |
| --- | --- |
| Transactional / automated email | enqueue from API; worker sends via **Resend** (already prod pattern in repo docs). |
| Daily user sync from third-party API | **BullMQ repeatable job** (cron) in worker; idempotent upserts; rate-limit API token use. |
| Other async work | same queue; prioritize separate queues (`email`, `sync`, `default`) for isolation. |

### 7.3 Security

- Redis: password + bind to Docker network only; optional TLS if you terminate TLS in front of Redis.
- Worker: same env as app for `DATABASE_URL` / mail keys; **least privilege** DB role if you introduce migrations-only user later.

---

## 8. GitHub CI, environments, and approval flow

### 8.1 Does “the GitHub CI team” manage envs?

**Yes — via repository settings**:

- **GitHub Environments** (`Settings → Environments`) hold **secrets** and **protection rules**.
- Use at least:
  - **`production`**: URL `https://mitsailing.com`, **required reviewers** (manual approval before deploy job), branch restriction to `main` if desired.
  - **`preview`** (per PR): separate secrets (SSH host for preview, tunnel token, DB password prefix, etc.) when you implement PR stacks.

### 8.2 Target workflow (your intent)

1. **PR opened/updated**: workflow builds image, deploys to **preview** stack (Compose project `mitsailing-pr-<number>`), reports preview URL.
2. **PR merged to `main`**: after **manual approval** on `production` environment, deploy job runs `deploy sha-…` to production (matches current [`deploy.yml`](../.github/workflows/deploy.yml) shape; add **environment approval** if not already).

**PRs must not use the production database.** Each preview needs its **own** `DATABASE_URL` (isolated data, migrations, secrets). That does **not** require a **dedicated Postgres container per PR** — see §8.2.1.

**Today’s repo**: production deploy runs on `push` to `main` without a blocking approval step in YAML — add **`environment: production`** with **Required reviewers** in the GitHub Environment UI so deploys wait for human approval.

#### 8.2.1 Is “a database per PR” a problem?

It **can** be, if every PR starts a **full Postgres container + named volume** on a **small shared host**:

**Default for this project (shared host, co-tenancy):** use the **lighter** model — **one long-lived preview Postgres** (its own Compose stack or service, **never** the production volume) plus a **logical database per PR** (`pr_<github_number>` or similar), each with its own role/password or connection string. PR stacks then run **app** (and optional **worker**/Redis) per preview with `DATABASE_URL` pointing at that logical DB. Reserve **container-per-PR Postgres** only if you need hard blast-radius isolation or heavy DB customization per branch.

| Risk | Mitigation |
| --- | --- |
| **RAM / CPU** | Many Postgres instances compete with production and co-tenant apps. Cap **concurrent previews** (e.g. 3–5), or deploy previews only for PRs with a **`preview`** label. |
| **Disk** | Volumes grow with schema and seeds; without **cleanup** on PR close/merge, storage leaks. Use a workflow on `pull_request` **closed** to **`DROP DATABASE`** (or equivalent) for `pr_<number>` and remove the app stack; the shared preview Postgres container stays up. |
| **Failures** | Each preview should run **`prisma migrate deploy`** (or your chosen migrate path); failed deploys should tear down partial stacks. |
| **Lighter pattern (recommended)** | **One** preview Postgres with **`CREATE DATABASE pr_<number>`** per PR — one memory footprint, still isolated from prod. Stronger isolation = extra Postgres **container** per PR (use only when justified). |
| **Host saturation** | If previews overwhelm the MIT box, run PR environments on **ephemeral cloud** and keep only **production** on self-hosted hardware. |

### 8.3 PR subdomains and Cloudflare API

- **Manual**: create `*.preview.mitsailing.com` or per-PR hostnames in Cloudflare dashboard; map in tunnel config.
- **Automated (recommended direction)**: GitHub Action using `CLOUDFLARE_API_TOKEN` (scoped to zone + tunnel edit) to upsert **public hostname** routes for `pr-<n>.preview.mitsailing.com` → `http://app:3000` on the preview tunnel or shared tunnel with path/host rules.

Document tokens in **`preview` environment secrets**, not in `production`.

---

## 9. Observability

| Layer | Tool | Notes |
| --- | --- | --- |
| Errors / traces | **Sentry** | Already aligned with typical Next.js setups; use DSN in env, separate projects for preview vs prod. |
| Logs | **Docker `json-file`** with rotation (already in `compose.prod.yaml` pattern); optionally forward to **Loki** or a hosted log drain. |
| Metrics | **Prometheus** + **Grafana** self-hosted **optional**; expose via tunnel subdomains (`grafana.mitsailing.com`) with **Cloudflare Access**. |

**Self-hosted** Grafana/Loki/Prometheus: run as an **orthogonal compose stack** with its own project name so it never collides with mitsailing volumes.

---

## 10. Patching and upgrades (recommended strategy)

| Surface | Cadence | Action |
| --- | --- | --- |
| Application image | Every merge to protected branch | CI builds and deploys; pins digest/tag in `deploy.sh` flow. |
| Base images (`node:…`, `postgres:…`, `cloudflared`) | **Weekly or monthly** | Rebuild app image; pull infra images with controlled `compose pull` during a maintenance window. |
| Host kernel / rootless Docker | **Monthly** (or org policy) | Operator with sudo runs distro updates; reboot during low traffic. |
| Secrets | **Quarterly** or on team change | Rotate `BETTER_AUTH_SECRET` (careful session impact), DB passwords, tunnel tokens, AWS keys. |

---

## 11. Email for manager (sudo) — Docker survives reboot / logout

Send when rootless containers **do not** restart until someone logs in.

**Subject**: One-time host setup for headless rootless Docker (mitsailing)

**Body**:

> We run **rootless Docker** under Linux user **`___DEPLOY_USER___`**. For containers to start after **reboot** and while **no one is logged in**, please run once (as root):
>
> ```bash
> sudo loginctl enable-linger ___DEPLOY_USER___
> ```
>
> Confirm the **rootless Docker** user unit is enabled so `dockerd` starts at boot for that user (distro-specific; on systemd with `docker context` rootless, this is often `systemctl --user enable docker` after `dockerd-rootless-setuptool.sh`):
>
> ```bash
> sudo -u ___DEPLOY_USER___ XDG_RUNTIME_DIR=/run/user/$(id -u ___DEPLOY_USER___) systemctl --user enable docker.service
> ```
>
> Optional but recommended: **unattended security updates** for the host (`unattended-upgrades` on Debian/Ubuntu) and a **reboot window** after kernel updates.
>
> No inbound firewall holes are required for the web app if we continue using **Cloudflare Tunnel**.

*(Adjust commands to your distro’s rootless Docker documentation.)*

---

## 12. Implementation checklist (engineering)

- [x] Add **`deploy.resources`** to `app`, `postgres`, `cloudflared`, **`worker`**, and **`redis`**.
- [x] Introduce **`worker` + `redis`** services and queue code paths (BullMQ stub in `src/worker/index.ts`).
- [ ] Add **backup** script + schedule meeting **15 min RPO** and **7 day** S3 lifecycle (*deferred — not in current milestone*).
- [x] GitHub **`production` environment`: document **required reviewers** + secrets (`PRODUCTION_*`) in [`deploy.md`](./deploy.md); wiring is repository UI.
- [x] **Preview** workflow (`.github/workflows/preview.yml`): repository secrets `PREVIEW_*`, image push per PR, teardown hook `preview-down <n>` on PR close (operator implements remote command).
- [x] Document **DB tunnel** procedure in [`deploy.md`](./deploy.md) — see **Database admin access (SSH tunnel)** (also §5.5 above).
- [ ] Cloudflare: **Access** policies for Bull Board / internal UIs (*operator / dashboard*).
- [x] Next.js (§3): **`stop_grace_period`** on `app` + **`worker`**; optional **`DEPLOYMENT_VERSION`** → `deploymentId`; document **`NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** and optional Data Cache volume note in `compose.prod.yaml` / `.env.production.example`; shared cache handler + **`refreshTags()`** only if scaling multiple `app` replicas (*application follow-up*).

---

## 13. Relation to existing docs

- Day-to-day production bootstrap remains [`deploy.md`](./deploy.md).
- This file is the **strategic** layer: jobs, backups, multi-tenant limits, preview strategy, governance, and **Next.js self-hosting / caching** expectations (§3). Update both when behavior changes.
