# Production readiness checklists

Last reviewed: 2026-06-05.

These checklists capture the production expectations for Redis, BullMQ, the CMS rich text editor, Mailpit email capture, PgHero database visibility, and Docker/Compose. Keep this file focused on operationally meaningful checks: configuration, runtime behavior, security boundaries, and verification evidence.

## Official references

- [BullMQ going to production](https://docs.bullmq.io/guide/going-to-production)
- [BullMQ deduplication](https://docs.bullmq.io/guide/jobs/deduplication)
- [Redis persistence](https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/)
- [Redis eviction](https://redis.io/docs/latest/develop/reference/eviction/)
- [Tiptap output guide](https://tiptap.dev/docs/guides/output-json-html)
- [Tiptap editor styling](https://tiptap.dev/docs/editor/getting-started/style-editor)
- [Tiptap image extension](https://tiptap.dev/docs/editor/extensions/nodes/image)
- [Mailpit configuration](https://mailpit.axllent.org/docs/configuration/)
- [Mailpit runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/)
- [Mailpit SMTP server](https://mailpit.axllent.org/docs/configuration/smtp/)
- [Mailpit web UI and API server](https://mailpit.axllent.org/docs/configuration/http/)
- [Mailpit email storage](https://mailpit.axllent.org/docs/configuration/email-storage/)
- [Mailpit integration testing](https://mailpit.axllent.org/docs/integration/)
- [Mailpit healthchecks](https://mailpit.axllent.org/docs/integration/healthcheck/)
- [Mailpit search filters](https://mailpit.axllent.org/docs/usage/search-filters/)
- [PgHero Docker guide](https://github.com/ankane/pghero/blob/master/guides/Docker.md)
- [PgHero permissions guide](https://github.com/ankane/pghero/blob/master/guides/Permissions.md)
- [PgHero query stats guide](https://github.com/ankane/pghero/blob/master/guides/Query-Stats.md)
- [PgTune](https://pgtune.leopard.in.ua/)
- [Docker Compose services reference](https://docs.docker.com/reference/compose-file/services/)
- [Docker build best practices](https://docs.docker.com/build/building/best-practices/)
- [Docker multi-stage builds](https://docs.docker.com/build/building/multi-stage/)
- [Docker Node.js container guide](https://docs.docker.com/guides/nodejs/containerize/)

## Status legend

- `Pass`: The current repo setup matches the check.
- `Watch`: The current setup is acceptable for this slice, but the item needs an operational follow-up or periodic review.
- `Follow-up`: The item is intentionally not solved in this slice and should not be treated as done.

## Redis

| Check | Status | Current evidence |
| --- | --- | --- |
| Redis is scoped to BullMQ/job processing, not reused as an unbounded app cache. | Pass | `REDIS_URL` usage is limited to worker, queue, readiness, and newsletter enqueue paths; Next.js data caching still uses `unstable_cache`. |
| Production Redis has durable storage. | Pass | `compose.yaml` runs Redis with `--appendonly yes` and mounts `/data` to the `redis_data` volume. |
| Production Redis uses `noeviction` for BullMQ safety. | Pass | `compose.yaml` sets `--maxmemory-policy noeviction`, matching BullMQ production guidance. |
| Redis has a bounded memory limit. | Pass | `compose.yaml` sets `--maxmemory 256mb` and service resource limits. |
| Redis is not published externally in production. | Pass | Production Compose keeps Redis on the internal network; host publishing is only in `compose.override.yaml` for local worker development. |
| Services wait for Redis health before starting dependent app workers. | Pass | `compose.prod.yaml` uses `depends_on` with `condition: service_healthy`, and Redis has a `redis-cli ping` healthcheck. |
| The worker healthcheck verifies Redis from inside the runtime container. | Pass | `scripts/worker-redis-healthcheck.cjs` validates `REDIS_URL` and performs `PING`; the worker service uses it as its healthcheck. |
| Redis connection URLs are validated through the typed env layer. | Pass | `src/libs/Env.ts` validates `REDIS_URL` and requires it for staging and production. |
| Queue Redis is kept separate from any future response-cache Redis. | Watch | Current code does not configure a Redis response cache. If a Next cache Redis is added later, use a separate URL and instance. |
| Backup and memory-rejection monitoring are documented operationally. | Follow-up | Redis docs recommend backups and monitoring rejected commands under `noeviction`; this repo verifies the mount but does not yet include a Redis backup/alert runbook. |

## BullMQ

| Check | Status | Current evidence |
| --- | --- | --- |
| Producers fail fast when Redis is unavailable. | Pass | `src/worker/defaultQueue.ts` and `src/libs/newsletter/newsletterQueue.ts` use `enableOfflineQueue: false` and finite retry settings. |
| Workers use BullMQ-compatible Redis retry behavior. | Pass | `src/worker/workerRuntime.ts` uses `maxRetriesPerRequest: null` for worker Redis connections. |
| Queue and worker errors are logged. | Pass | Default queue, newsletter queue, and worker runtime register error handlers. |
| Jobs remove completed and failed records after bounded retention. | Pass | Worker job producers set `removeOnComplete` and `removeOnFail` options instead of keeping unlimited Redis history. |
| Duplicate media work is deduplicated with BullMQ semantics. | Pass | `src/worker/cmsMediaProcessingJob.ts` uses BullMQ `deduplication` with a stable asset ID. |
| Job IDs use Redis-safe, readable identifiers. | Pass | Payment, reminder, and reservation jobs use hyphenated deterministic IDs. |
| Sensitive job data is minimized. | Pass | Pavilion reservation email jobs enqueue only the reservation reference and load details from Postgres at execution time. |
| Worker startup reconciles durable DB state with queued jobs. | Pass | The worker startup path reconciles CMS media processing jobs instead of relying only on in-memory enqueue events. |
| E2E runs exercise the production-like standalone server and worker. | Pass | `scripts/e2e-start.cjs`, `scripts/e2e-build.cjs`, and `playwright.config.ts` run the standalone server with `worker.mjs`. |
| Graceful shutdown closes queues, workers, and Redis connections. | Pass | `src/worker/workerRuntime.ts` closes workers, queues, and Redis; `scripts/e2e-start.cjs` forwards shutdown signals to child processes. |

## Rich Text Editor

| Check | Status | Current evidence |
| --- | --- | --- |
| The editor is client-only and avoids server-rendered editor hydration drift. | Pass | `src/components/mit-sailing/admin/catalog/AdminRichTextEditor.tsx` is a client component and uses `immediatelyRender: false`. |
| The editable schema is intentionally small. | Pass | StarterKit is configured to the supported CMS subset instead of exposing the full editor surface. |
| Stored HTML is sanitized on the server boundary. | Pass | `src/libs/mit-sailing/cmsRichText.ts` uses `sanitize-html` and narrow tag, attribute, link, and image rules. |
| Unsafe links are blocked in the editor and sanitizer. | Pass | The editor blocks unsafe schemes; the sanitizer strips unsafe, obfuscated, traversal, and malformed links. |
| Images are uploaded through app-owned media storage, not embedded as data URLs. | Pass | Tiptap image config sets `allowBase64: false`; persisted images are limited to `/cms-media/:id/:filename`. |
| Image dimensions and alignment are normalized. | Pass | Image width and height are clamped; alignment is normalized to the supported values. |
| Editor styles are scoped to CMS content. | Pass | `src/styles/global.css` styles `.cms-rich-text`, including rendered CMS content and Tiptap resize wrappers. |
| External links get safe browser attributes. | Pass | The sanitizer adds `rel="noopener noreferrer"` and `target="_blank"` for external HTTP(S) links. |
| Rich text is covered by sanitizer, component, and browser-path tests. | Pass | `cmsRichText.test.ts`, editor tests, and `tests/e2e/AdminCmsRichText.e2e.ts` cover unsafe markup, media upload, picker, preview, and save paths. |
| Existing-image click/resize behavior is covered. | Pass | `tests/e2e/AdminCmsRichText.e2e.ts` reloads a saved page block, selects the existing image, changes alignment, and changes image size. |

## Mailpit

| Check | Status | Current evidence |
| --- | --- | --- |
| Local and E2E email flows use real SMTP capture instead of mocking the app mail driver. | Pass | `.env.example` and `playwright.config.ts` set `MAIL_TRANSPORT=smtp`, `SMTP_URL=smtp://127.0.0.1:1025`, and `MAILPIT_API_URL=http://127.0.0.1:8025`; E2E tests read captured messages through `tests/helpers/mailpit.ts`. |
| The local Mailpit image is pinned to a current v1 release, not `latest`. | Pass | Compose uses `axllent/mailpit:v1.30.1`, the current security release reviewed for this checklist. Dependabot monitors Dockerfile and Docker Compose images. |
| Mailpit SMTP and HTTP/API ports are loopback-only in local development. | Pass | `compose.override.yaml` publishes both `1025` and `8025` on `127.0.0.1`, so unauthenticated local capture is not exposed on the LAN. |
| Mailpit readiness uses the official healthcheck endpoint. | Pass | The Mailpit service healthcheck calls `http://localhost:8025/readyz`. |
| Stored test mail is bounded and pruned. | Pass | `MP_DATABASE=/data/mailpit.db` persists local messages for debugging, while `MP_MAX_MESSAGES=5000` and `MP_MAX_AGE=7d` cap retention. |
| Selective real delivery is owned by Mailpit, not app code. | Pass | Production Mailpit config uses `MP_SMTP_RELAY_*` with `MP_SMTP_RELAY_MATCHING`, so the app sends SMTP to Mailpit and Mailpit decides which recipients are relayed through Resend. |
| E2E standalone runtime has a complete SMTP sender config. | Pass | `playwright.config.ts` defaults `EMAIL_FROM` to `MIT Sailing <noreply@mitsailing.test>` before starting the standalone server. |
| Tests isolate reads through recipient-scoped API queries. | Pass | `findLatestMessageToMatching` searches Mailpit with `to:<email>` and fetches full messages by ID before assertions. |
| Test cleanup uses Mailpit API deletion. | Pass | `deleteAllMessages()` calls `DELETE /api/v1/messages`; individual tests also use unique recipient addresses to avoid parallel-worker collisions. |
| Unauthenticated Mailpit is limited to local development. | Pass | Local Compose accepts any SMTP credentials only on loopback. Shared staging/production capture uses `MAILPIT_UI_AUTH`, app nginx proxies Mailpit at `/mail/`, and Cloudflare Access/rate limiting protects the path. |
| Mailpit CORS is not opened broadly. | Pass | No `MP_API_CORS=*` or browser cross-origin Mailpit API access is configured; tests call the API server-side from Playwright helpers. |

## PgHero

| Check | Status | Current evidence |
| --- | --- | --- |
| PgHero stays in its own container and is not published externally. | Pass | `compose.prod.yaml` runs `ankane/pghero:v3.8.0` on the internal network with no `ports:` mapping. |
| PgHero is top-admin gated by app auth and has CPU/memory limits. | Pass | app nginx proxies `/_ops/harbor-watch/` only after `auth_request /api/internal/pghero-auth`; the endpoint allows only `Role.ADMIN`. Compose limits PgHero to `0.25` CPU and `512M` memory with `0.05` CPU and `128M` reservations. |
| PgHero uses a dedicated database URL. | Pass | `PGHERO_DATABASE_URL` is required separately from `DATABASE_URL`; the env examples use a `pghero` role. |
| Query stats can be enabled without production-only drift. | Pass | Compose preloads `pg_stat_statements` with PgHero's documented settings, and the Prisma migration creates the extension. |
| PostgreSQL tuning changes stay reviewable. | Watch | PgHero's Tune page links PgTune; operators should use `https://pgtune.leopard.in.ua/` with actual host RAM/CPU and PostgreSQL version, then commit reviewed Compose/Postgres config changes instead of hand-editing production. |
| PgHero image updates are automated. | Pass | Dependabot monitors Docker Compose service images, so `ankane/pghero` updates arrive as PRs with CI and image scanning. |

## Docker and Compose

| Check | Status | Current evidence |
| --- | --- | --- |
| The app image uses multi-stage builds. | Pass | `Dockerfile` has `deps`, `builder`, `dev`, and `prod` stages. |
| The runtime container runs as a non-root user with a stable UID/GID. | Pass | `Dockerfile` creates and uses `nextjs` with UID/GID `1001`. |
| Docker build context excludes local secrets and heavy generated artifacts. | Pass | `.dockerignore` excludes `.env*` except examples, `node_modules`, build outputs, `.git`, logs, and local reports. |
| Production services have healthchecks. | Pass | `compose.prod.yaml` defines healthchecks for web, worker, media, tusd, Redis, and Postgres. |
| Service dependencies wait for health, not just container start. | Pass | `compose.prod.yaml` uses `depends_on.condition: service_healthy` for production dependencies. |
| Stateful production mounts are explicit and do not auto-create missing host paths. | Pass | Production bind mounts use `create_host_path: false` for data paths that must exist. |
| Shutdown gets a grace period. | Pass | Production web, worker, media, tusd, Redis, and Postgres services set `stop_grace_period`. |
| Container logs are bounded. | Pass | Production services use json-file log rotation options. |
| Docker images are built, smoke-tested, and scanned in CI. | Pass | `.github/workflows/docker-pr.yml` builds the production image, tests server and worker startup, and runs Trivy scans. |
| Supply-chain provenance is attached during deploy. | Pass | `.github/workflows/deploy.yml` builds/pushes the image and publishes provenance/SBOM attestations. |
| Base and service images are tag-pinned but not digest-pinned. | Watch | Tags are explicit, CI scans images, and Dependabot monitors both Dockerfile and Docker Compose image tags. Docker docs recommend digest pinning when reproducibility is more important than automatic patch pickup. |
| The Cloudflare tunnel can self-update at runtime. | Watch | `compose.prod.yaml` pins `cloudflare/cloudflared` for reviewed base deploys, but uses `--autoupdate-freq 24h` as a security override. Cloudflare documents that updates restart `cloudflared` and can affect active traffic. |
| Single-host `.env` files are used instead of Docker secrets. | Watch | Current deployment is a single-host Compose setup. Docker secrets are stronger for swarm/managed platforms, but would add operational scope beyond this slice. |
