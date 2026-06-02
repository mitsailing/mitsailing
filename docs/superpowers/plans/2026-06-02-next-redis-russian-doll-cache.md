# Next Redis Russian-Doll Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a self-hosted Redis-backed Next.js remote cache for public SSR data so admins can edit CMS/catalog content without rebuilding the website.

**Architecture:** Keep the existing persistent `redis` service dedicated to BullMQ/background jobs. Add a second internal `redis_cache` service with cache eviction, then configure Next.js Cache Components with a `remote` cache handler. Run a package-first spike against current Next 16 Cache Components handlers; use a dependency only if it passes the repo gates and admin-invalidation semantics. Cache stable public data in inner "Russian doll" units with tags, while session/admin/user-specific shell data remains request-bound.

**Tech Stack:** Next.js 16.2 Cache Components, React 19 Server Components, Redis 8, ioredis, Docker Compose, Prisma, Vitest.

---

## Official June 2026 Source Boundary

Use only these source families for framework/cache decisions:

- Next.js docs: `cacheHandlers`, `use cache: remote`, `cacheLife`, `cacheTag`, `updateTag`, `revalidateTag`, `connection`.
- React docs: `cache(fn)` request memoization.
- Redis docs: persistence and eviction.
- Docker docs: Compose service networking and bind mounts.

Repo facts used by this plan:

- `compose.yaml` currently has `redis` with `--appendonly yes` and `--maxmemory-policy noeviction`; keep that for queues.
- `compose.prod.yaml` bind-mounts production Redis under `${PRODUCTION_DATA_ROOT}/redis`; keep that for durable queue state.
- `next.config.ts` has `output: 'standalone'` and no `cacheComponents` or `cacheHandlers`.
- `src/app/[locale]/layout.tsx` exports app-wide `dynamic = 'force-dynamic'`; Cache Components removes that segment option, so this plan must replace it with an official request-time/Suspense boundary before enabling `cacheComponents`.
- `src/libs/mit-sailing/cmsQueries.ts` loads CMS menus/pages directly from Prisma or React request `cache`; migrate these first because menu items are updated rarely and admin-controlled.

## Package Reference Boundary

Learn from current packages, but do not treat any package as approved until it passes the gates below:

- `@mrjasonroy/cache-components-cache-handler`: first dependency candidate because it targets Next 16 Cache Components, supports `cacheHandlers.remote`, uses the repo's existing `ioredis` family, and can receive an explicit cache Redis URL. Its `revalidateTag` issue history must be covered by the admin freshness gate.
- `@trieb.work/nextjs-turbo-redis-cache`: borrow Next 16.2 Cache Components integration tests, Redis timeout handling, keyspace notification requirements, and key-prefix/deploy-isolation ideas. Use as the second dependency candidate only if it can satisfy the separate-cache-Redis gate without persistent `REDIS_URL` rewriting and without stale local memory after `updateTag()`.
- `@leejpsd/nextjs-cache-handler`: borrow build-phase skip, deployment namespace, Lua/tag atomicity, and single-flight refresh ideas. Do not adopt it without explicit user approval because it is pre-v1 with minimal adoption.
- `@fortedigital/nextjs-cache-handler` and `@neshca/cache-handler`: historical references only. Do not select them for this plan because their current published surfaces do not support this Next 16 Cache Components remote-handler slice.

Dependency adoption gates:

- Supports Next.js 16.2 `cacheComponents: true` and plural `cacheHandlers`.
- Can be configured against `NEXT_CACHE_REDIS_URL`, not queue `REDIS_URL`. Reject candidates that require a process-global `REDIS_URL` override for runtime cache operations.
- Supports `'use cache: remote'` or can be mapped to the official remote handler type without making all cache scopes local-only.
- Does not serve stale CMS/menu/page data after admin Server Actions call `updateTag()`.
- Passes `npm run build-local`, `npm run check:types`, and focused CMS/admin invalidation tests.
- Does not require changing the durable queue Redis eviction policy.

## June 2026 Hardening Issues Found Before Implementation

Treat these as blockers for implementation workers:

- `@fortedigital/nextjs-cache-handler` and `@neshca/cache-handler` are not first-pass candidates. Their current package/docs history is useful for older tag-map ideas, but this plan is for Next 16 Cache Components and plural `cacheHandlers`.
- `@trieb.work/nextjs-turbo-redis-cache` is a spike candidate, not an approved dependency. Its own docs describe Cache Components support as experimental, require Redis keyspace notifications, use the official `redis` client peer, and default to short local in-memory/dedup windows. Those behaviors must be proven compatible with admin read-your-own-writes before adoption.
- Do not leave a wrapper that rewrites `process.env.REDIS_URL`. This repo already uses `REDIS_URL` for BullMQ/background jobs, so a package adapter must pass a candidate-specific Redis URL option or the candidate is rejected.
- `cacheHandlers.remote` must be verified with an actual `'use cache: remote'` CMS read. A package README that only shows `cacheHandlers.default` is not enough.
- CMS cache lifetime should be admin-invalidated first, with a long server revalidation period. Do not use a one-day client stale period for admin-editable menus because active client navigations may not check the server promptly after an admin edit.
- `volatile-lru` is the default cache Redis eviction policy. If a selected handler stores tag invalidation metadata with TTLs or otherwise makes metadata evictable, reject it unless it proves stale CMS cannot be served after eviction.
- `updateTag` belongs in Server Actions. If a future admin mutation moves to a route handler, webhook, or background job, use `revalidateTag(tag, { expire: 0 })` for immediate expiration.
- The current root layout remains request-bound because `src/app/[locale]/layout.tsx` reads user/theme data. This first slice reduces repeated public CMS DB reads; it does not claim full-page static rendering.
- Do not cache root layout, `SiteShell`, `SiteShellHeaderNav`, `SiteFooter`, admin edit links, or any component/function that reads session, `headers()`, `cookies()`, request URL/search params, `connection()`, or per-user/admin state. Cache only pure public DTO loaders with explicit arguments.

## Hardening Sub-Agent Review Packets

Run these read-only review agents before implementing this plan and after any material plan change. Each agent must return `Blocker`, `Important`, `Slop/Scope Control`, and `Recommended Plan Patch` sections with exact file/line evidence. They must not edit files.

### Agent 1: Official Next/React Cache Reviewer

```text
Repo: /Users/andrewkelley/GitHub/mitsailing
Plan: docs/superpowers/plans/2026-06-02-next-redis-russian-doll-cache.md

Use June 2026 official Next.js and React docs only for framework claims, plus installed Next source/types if useful. Review whether the plan correctly uses Next.js 16.2 Cache Components, plural cacheHandlers, 'use cache: remote', cacheLife/cacheTag/updateTag/revalidateTag, React cache(), SSR, standalone output, and request-bound root layout behavior.

Find misuses, stale-data risks, missing build/runtime gates, and places where the plan uses the old Next.js cache model.
```

### Agent 2: Package Risk Reviewer

```text
Repo: /Users/andrewkelley/GitHub/mitsailing
Plan: docs/superpowers/plans/2026-06-02-next-redis-russian-doll-cache.md

Use current June 2026 npm metadata and upstream package docs/issues. Compare @trieb.work/nextjs-turbo-redis-cache, @mrjasonroy/cache-components-cache-handler, @leejpsd/nextjs-cache-handler, @fortedigital/nextjs-cache-handler, and @neshca/cache-handler for this repo's CMS/admin invalidation goal.

Check version >= v1, recent update, adoption signals, Next 16 plural cacheHandlers support, Redis client dependency, keyspace notifications, local memory/dedup staleness, separate NEXT_CACHE_REDIS_URL fit, and whether production adoption is justified.
```

### Agent 3: CMS/Admin Invalidation Reviewer

```text
Repo: /Users/andrewkelley/GitHub/mitsailing
Plan: docs/superpowers/plans/2026-06-02-next-redis-russian-doll-cache.md

Inspect src/libs/mit-sailing/cmsQueries.ts, src/libs/admin/catalog/catalogActions.ts and tests, src/app/[locale]/layout.tsx, public shell/nav/footer usage, sitemap/cache helpers, and CMS/admin code. For a CMS site where menus may update yearly, identify stale-data risks, missing invalidation paths, over-broad tags, per-user caching risks, and missing tests.

Specifically answer whether public CMS reads should refresh only after admin changes except for a long safety revalidation window.
```

### Agent 4: Single-Host Redis Ops Reviewer

```text
Repo: /Users/andrewkelley/GitHub/mitsailing
Plan: docs/superpowers/plans/2026-06-02-next-redis-russian-doll-cache.md

Use June 2026 official Redis and Docker docs only for Redis/Compose claims. Inspect compose.yaml, compose.prod.yaml, bin/deploy.sh, and readiness code. Review the durable BullMQ Redis plus separate cache Redis design.

Find issues in eviction policy, persistence, keyspace notifications, memory sizing, security/network exposure, readiness, deploy blue/green/no-deps behavior, and operational failure modes. Pay special attention to whether eviction can break tag invalidation metadata.
```

### Agent 5: Anti-Slop Performance Reviewer

```text
Repo: /Users/andrewkelley/GitHub/mitsailing
Plan: docs/superpowers/plans/2026-06-02-next-redis-russian-doll-cache.md

Apply AGENTS.md constraints: minimal changes, package-first simple, no agent slop, admin/CMS user-path first, TypeScript, existing patterns, and build-local as a gate. Identify overengineered custom code, broad refactors to defer, tests that give false confidence, and the highest-impact performance fixes to keep.
```

## File Structure

- Create `cache-handlers/next-cache-components.cjs`: thin package wrapper loaded by `cacheHandlers.remote` when a dependency passes the gates.
- Create `cache-handlers/next-cache-components.test.ts`: package-wrapper tests for explicit cache Redis configuration, tag invalidation, missing Redis env, and no queue Redis env mutation.
- Modify `src/app/[locale]/layout.tsx`: replace removed `dynamic = 'force-dynamic'` route segment config with an official request-time Suspense boundary.
- Modify `next.config.ts`: enable Cache Components and register the remote handler path.
- Modify `compose.yaml`: add `redis_cache` service on `internal`.
- Modify `compose.override.yaml`: publish local `redis_cache` on a separate loopback port.
- Modify `compose.prod.yaml`: add `redis_cache` dependency for web containers.
- Modify `package.json`: include `redis_cache` in `db:up`.
- Modify `.env.production.example`, `.env.staging.example`, `.env.example`: add `NEXT_CACHE_REDIS_URL`.
- Modify `src/libs/Env.ts` and `src/libs/Env.test.ts`: validate `NEXT_CACHE_REDIS_URL` in staging/production.
- Modify `bin/deploy.sh`, `src/libs/deploy/dockerComposeContract.test.ts`, and `src/libs/deploy/singleHostDeployScript.test.ts`: start and wait for `redis_cache` before web because deploy uses `--no-deps`.
- Modify `src/libs/health/readiness.ts` and `src/libs/health/readiness.test.ts`: expose a service-readiness check for the Next cache Redis.
- Modify `src/libs/mit-sailing/cmsQueries.ts`: add remote-cached CMS menu/page loaders.
- Create `src/libs/mit-sailing/cmsCache.ts`: public CMS cache tags and cache-life constants.
- Modify `src/libs/admin/catalog/catalogActions.ts` and tests: call `updateTag` for CMS menu/page mutations.
- Modify `src/app/sitemap.ts`, `src/app/sitemap.test.ts`, and `src/libs/mit-sailing/sitemapCache.ts`: include published CMS paths in `/sitemap.xml` and invalidate after CMS page mutations.

---

### Task 1: Add Environment Validation For The Dedicated Next Cache Redis URL

**Files:**
- Modify: `src/libs/Env.ts`
- Modify: `src/libs/Env.test.ts`
- Modify: `.env.example`
- Modify: `.env.production.example`
- Modify: `.env.staging.example`

- [ ] **Step 1: Write failing env tests**

Add this helper line inside `stubRequiredProductionEnv()` in `src/libs/Env.test.ts`:

```ts
vi.stubEnv('NEXT_CACHE_REDIS_URL', 'redis://redis_cache:6379');
```

Add this test after `requires media server settings in production`:

```ts
it('requires the next cache redis url in production', async () => {
  stubRequiredBaseEnv();
  stubNewsletterRevalidateSecret();
  vi.stubEnv('APP_ENV', 'production');
  vi.stubEnv('CMS_MEDIA_ROOT', '/var/lib/mitsailing/cms-media');
  vi.stubEnv('HEALTHCHECK_SECRET', 'x'.repeat(32));
  vi.stubEnv('MEDIA_PUBLIC_BASE_URL', 'https://mitsailing.com');
  vi.stubEnv('MEDIA_STORAGE_ROOT', '/var/lib/mitsailing/cms-media');
  vi.stubEnv('MEDIA_UPLOAD_BASE_URL', 'https://mitsailing.com');
  vi.stubEnv('MEDIA_UPLOAD_SHARED_SECRET', 'x'.repeat(32));
  vi.stubEnv('NEXT_SERVER_ACTIONS_ENCRYPTION_KEY', 'x'.repeat(32));
  vi.stubEnv('REDIS_URL', 'redis://redis:6379');
  stubRequiredStripeEnv();

  await expect(import('@/libs/Env')).rejects.toThrow(
    'Invalid environment variables'
  );
});
```

Update `accepts docker stack production media endpoints`:

```ts
vi.stubEnv('NEXT_CACHE_REDIS_URL', 'redis://redis_cache:6379');
expect(Env.NEXT_CACHE_REDIS_URL).toBe('redis://redis_cache:6379');
```

- [ ] **Step 2: Run the env tests and confirm the failure**

Run: `npm run test -- src/libs/Env.test.ts`

Expected: FAIL because `NEXT_CACHE_REDIS_URL` is not in `Env`.

- [ ] **Step 3: Add `NEXT_CACHE_REDIS_URL` to `FinalEnv`**

In `src/libs/Env.ts`, extend `FinalEnv`:

```ts
NEXT_CACHE_REDIS_URL?: string;
```

- [ ] **Step 4: Require it for staging and production**

In `validateDeploymentEnv`, add this block immediately after the `REDIS_URL` block:

```ts
if (!env.NEXT_CACHE_REDIS_URL) {
  addEnvIssue(
    ctx,
    'NEXT_CACHE_REDIS_URL',
    'NEXT_CACHE_REDIS_URL is required in staging and production.'
  );
}
```

- [ ] **Step 5: Add it to the server schema**

In the `server` object, add it after `REDIS_URL`:

```ts
// Dedicated Redis for Next.js Cache Components remote cache. Keep separate from BullMQ Redis.
NEXT_CACHE_REDIS_URL: z.url().optional(),
```

- [ ] **Step 6: Add it to `runtimeEnv`**

In `runtimeEnv`, add:

```ts
NEXT_CACHE_REDIS_URL: process.env.NEXT_CACHE_REDIS_URL,
```

- [ ] **Step 7: Add env examples**

In `.env.production.example` and `.env.staging.example`, add after `REDIS_URL`:

```env
NEXT_CACHE_REDIS_URL=redis://redis_cache:6379
```

In `.env.example`, add:

```env
NEXT_CACHE_REDIS_URL=redis://127.0.0.1:6380
NEXT_CACHE_REDIS_PUBLISH_PORT=6380
```

- [ ] **Step 8: Run the env tests**

Run: `npm run test -- src/libs/Env.test.ts`

Expected: PASS.

---

### Task 2: Add A Separate Cache Redis Service To The Single-Host Compose Stack

**Files:**
- Modify: `compose.yaml`
- Modify: `compose.override.yaml`
- Modify: `compose.prod.yaml`
- Modify: `package.json`
- Modify: `bin/deploy.sh`
- Modify: `src/libs/deploy/dockerComposeContract.test.ts`
- Modify: `src/libs/deploy/singleHostDeployScript.test.ts`

- [ ] **Step 1: Add failing deploy contract assertions**

In `src/libs/deploy/dockerComposeContract.test.ts`, read the base Compose and package files with the existing `readRepoFile` helper:

```ts
const baseCompose = readRepoFile('compose.yaml');
const packageJson = readRepoFile('package.json');
```

Add assertions that the base Compose file includes `redis_cache` and that it does not mount durable queue data:

```ts
expect(baseCompose).toContain('redis_cache:');
expect(baseCompose).toContain('image: redis:8-alpine');
expect(baseCompose).toContain('--appendonly no');
expect(baseCompose).toContain('--maxmemory-policy volatile-lru');
expect(baseCompose).not.toContain('redis_cache:/data');
```

In the existing `local docker compose` describe block, add:

```ts
expect(localCompose).toContain('redis_cache:');
expect(localCompose).toContain(
  `'127.0.0.1:${composeVariable('NEXT_CACHE_REDIS_PUBLISH_PORT:-6380')}:6379'`
);
```

Add one package script assertion:

```ts
expect(packageJson).toContain(
  'docker compose up -d postgres mailpit redis redis_cache tusd media'
);
```

In `src/libs/deploy/singleHostDeployScript.test.ts`, add:

```ts
expect(script).toContain(
  'compose up --detach --no-recreate postgres redis redis_cache tusd media'
);
expect(script).toContain('wait_for_service_health redis_cache "$DEPLOY_HEALTH_TIMEOUT_SECONDS"');
```

- [ ] **Step 2: Run deploy tests and confirm the failure**

Run: `npm run test -- src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/singleHostDeployScript.test.ts`

Expected: FAIL because `redis_cache` is not configured or started.

- [ ] **Step 3: Add `redis_cache` to `compose.yaml`**

Add this service after the existing `redis` service:

```yaml
  redis_cache:
    image: redis:8-alpine
    restart: unless-stopped
    networks:
      - internal
    command: >-
      redis-server
      --save ""
      --appendonly no
      --maxmemory ${NEXT_CACHE_REDIS_MAXMEMORY:-512mb}
      --maxmemory-policy volatile-lru
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 2s
      timeout: 3s
      retries: 30
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 640M
        reservations:
          cpus: '0.05'
          memory: 64M
```

- [ ] **Step 4: Add `redis_cache` dependency for production web containers**

In `compose.prod.yaml`, extend `x-web.depends_on`:

```yaml
    redis_cache:
      condition: service_healthy
```

Do not add a production bind mount for `redis_cache` in the first version. Cache entries are recomputable and Redis official persistence guidance does not require durability for cache-only data.

- [ ] **Step 5: Add local loopback access and `db:up` coverage**

In `compose.override.yaml`, publish `redis_cache` on a distinct loopback port:

```yaml
  redis_cache:
    ports:
      # Dedicated local Next.js cache Redis. Keep separate from REDIS_URL/queue Redis.
      - '127.0.0.1:${NEXT_CACHE_REDIS_PUBLISH_PORT:-6380}:6379'
```

In `package.json`, add `redis_cache` to the existing `db:up` script without changing other services:

```json
"db:up": "docker compose up -d postgres mailpit redis redis_cache tusd media"
```

- [ ] **Step 6: Start and wait for `redis_cache` during deploy**

In `bin/deploy.sh`, update `ensure_ingress_services()` so it starts `redis_cache` with the other data-plane services and waits for it before starting web:

```bash
compose up --detach --no-recreate postgres redis redis_cache tusd media
wait_for_service_health postgres "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
wait_for_service_health redis "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
wait_for_service_health redis_cache "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
wait_for_service_health tusd "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
wait_for_service_health media "$DEPLOY_HEALTH_TIMEOUT_SECONDS"
```

In `run_migrations_for_service()`, keep waiting for `postgres` and `redis`. Do not require `redis_cache` for migrations because Next cache is not needed for Prisma migrations.

- [ ] **Step 7: Run deploy tests**

Run: `npm run test -- src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/singleHostDeployScript.test.ts`

Expected: PASS.

---

### Task 3: Run The Package Reference Spike

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `cache-handlers/next-cache-components.cjs`
- Create: `cache-handlers/next-cache-components.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Record the candidate order**

Use this order and do not skip the gates:

```text
1. @mrjasonroy/cache-components-cache-handler
2. @trieb.work/nextjs-turbo-redis-cache only if it can avoid persistent REDIS_URL rewriting
3. @leejpsd/nextjs-cache-handler only with explicit pre-v1 approval
```

Expected: `@mrjasonroy/cache-components-cache-handler` is attempted first because it is Next 16-only, supports `cacheHandlers.remote`, uses ioredis-compatible Redis configuration, and can accept an explicit cache Redis URL. It is rejected if its current `revalidateTag` issue history reproduces under the admin freshness gate.

- [ ] **Step 2: Install only the first candidate**

Run:

```bash
npm install @mrjasonroy/cache-components-cache-handler
```

Expected: `package.json` and `package-lock.json` include exactly this new cache-handler package and no custom Redis cache implementation. If this candidate fails the gates, uninstall it before trying `@trieb.work/nextjs-turbo-redis-cache`.

- [ ] **Step 3: Add a thin wrapper using the dedicated cache Redis URL**

Create `cache-handlers/next-cache-components.cjs`:

```js
if (!process.env.NEXT_CACHE_REDIS_URL) {
  throw new Error(
    'NEXT_CACHE_REDIS_URL is required for the Next.js remote cache handler'
  );
}

const { createCacheHandler } = require('@mrjasonroy/cache-components-cache-handler');

const queueRedisUrl = process.env.REDIS_URL;
const handler = createCacheHandler({
  type: 'redis',
  url: process.env.NEXT_CACHE_REDIS_URL,
  keyPrefix: process.env.NEXT_CACHE_REDIS_PREFIX || 'mitsailing:next-cache:',
  tagPrefix: process.env.NEXT_CACHE_REDIS_TAG_PREFIX || 'mitsailing:next-cache:tag:',
  debug: process.env.NEXT_PRIVATE_DEBUG_CACHE === '1',
});

if (process.env.REDIS_URL !== queueRedisUrl) {
  if (queueRedisUrl === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = queueRedisUrl;
  }
  throw new Error('Next cache handler must not mutate REDIS_URL');
}

module.exports = handler;
```

This wrapper is intentionally small. Its only job is adapting the package to the repo’s two-Redis setup so queue Redis remains separate. It must not write `process.env.REDIS_URL`.

- [ ] **Step 4: Add wrapper tests**

Create `cache-handlers/next-cache-components.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('next-cache-components handler wrapper', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('requires the dedicated cache redis url', async () => {
    await expect(import('./next-cache-components.cjs')).rejects.toThrow(
      'NEXT_CACHE_REDIS_URL is required for the Next.js remote cache handler'
    );
  });

  it('passes the dedicated redis url without changing queue redis', async () => {
    vi.stubEnv('REDIS_URL', 'redis://redis:6379');
    vi.stubEnv('NEXT_CACHE_REDIS_URL', 'redis://redis_cache:6379');
    const createCacheHandler = vi.fn(() => ({
      get: vi.fn(),
      set: vi.fn(),
      refreshTags: vi.fn(),
      getExpiration: vi.fn(),
      updateTags: vi.fn(),
    }));
    vi.doMock('@mrjasonroy/cache-components-cache-handler', () => ({
      createCacheHandler,
    }));

    const handlerModule = await import('./next-cache-components.cjs');

    expect(createCacheHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        keyPrefix: 'mitsailing:next-cache:',
        tagPrefix: 'mitsailing:next-cache:tag:',
        type: 'redis',
        url: 'redis://redis_cache:6379',
      })
    );
    expect(process.env.REDIS_URL).toBe('redis://redis:6379');
    expect(handlerModule.default ?? handlerModule).toHaveProperty('get');
  });

  it('does not allow handlers that require process global queue redis mutation', async () => {
    vi.stubEnv('REDIS_URL', 'redis://redis:6379');
    vi.stubEnv('NEXT_CACHE_REDIS_URL', 'redis://redis_cache:6379');
    vi.doMock('@mrjasonroy/cache-components-cache-handler', () => ({
      createCacheHandler: vi.fn(() => {
        process.env.REDIS_URL = process.env.NEXT_CACHE_REDIS_URL;
        return {
          get: vi.fn(),
          set: vi.fn(),
          refreshTags: vi.fn(),
          getExpiration: vi.fn(),
          updateTags: vi.fn(),
        };
      }),
    }));

    await expect(import('./next-cache-components.cjs')).rejects.toThrow(
      'Next cache handler must not mutate REDIS_URL'
    );

    expect(process.env.REDIS_URL).toBe('redis://redis:6379');
  });
});
```

- [ ] **Step 5: Register the package wrapper in `next.config.ts`**

Use `cacheHandlers.remote`, not the older singular `cacheHandler`, for the CMS Cache Components slice. If a candidate package requires registering both `default` and `remote` to satisfy its tests, registering both is allowed, but the CMS functions must still use `'use cache: remote'` and must prove the remote handler is used:

```ts
cacheComponents: true,
cacheHandlers: {
  remote: nextCacheComponentsHandlerPath,
},
cacheMaxMemorySize: 0,
```

Add the path using `fileURLToPath(import.meta.url)` and `path.join(...)`, matching this repo’s ESM-style `next.config.ts`.

- [ ] **Step 6: Run the package gate**

Run:

```bash
npm run test -- cache-handlers/next-cache-components.test.ts
npm run check:types
npm run build-local
```

Expected: PASS. If this fails because the package cannot satisfy Next 16.2 `cacheHandlers.remote`, standalone output, or admin tag invalidation, uninstall the package and repeat Steps 2-6 with `@trieb.work/nextjs-turbo-redis-cache` only if it can satisfy the no-persistent-`REDIS_URL`-mutation gate. If `@trieb.work/nextjs-turbo-redis-cache` is selected, add `--notify-keyspace-events Exe` to `redis_cache` and update the deploy contract test because that package requires keyspace notifications. If both candidates fail, stop and ask the user before considering the pre-v1 `@leejpsd/nextjs-cache-handler`.

- [ ] **Step 7: Run the admin freshness gate after CMS tags are implemented**

After Tasks 6 and 7 are complete, edit a CMS menu item in admin and verify the public shell sees the new label on the next request. Also edit a linked CMS page path and verify header/footer links update. If the package’s local memory/dedup layer serves stale content after `updateTag()`, disable that layer if supported. If it cannot be disabled, reject the package and stop; do not build a custom Redis cache handler in this PR.

---

### Task 4: Handle Cache Components Root Request Boundary

**Files:**
- Modify: `src/app/[locale]/layout.tsx`
- Modify: `src/app/[locale]/layout.test.ts`

- [ ] **Step 1: Add a layout test for the request-time body boundary**

In `src/app/[locale]/layout.test.ts`, update the layout tests so the root layout no longer resolves user theme before returning the document shell:

```ts
it('keeps request-bound theme resolution below the html shell', async () => {
  const layoutModule = await import('./layout');

  expect(layoutModule).not.toHaveProperty('dynamic');

  const tree = await layoutModule.default({
    children: <main>content</main>,
    params: Promise.resolve({ locale: 'en' }),
  });

  expect(themeHooks.getDefaultThemeForRootLayout).not.toHaveBeenCalled();

  const html = renderToStaticMarkup(tree);
  expect(html).toContain('<html');
  expect(html).toContain('lang="en"');
});

it('renders request-bound theme body separately', async () => {
  themeHooks.getDefaultThemeForRootLayout.mockResolvedValue('dark');
  const { RequestBoundBody } = await import('./layout');

  const body = await RequestBoundBody({
    children: <main data-testid="child">content</main>,
  });
  const html = renderToStaticMarkup(body);

  expect(themeHooks.getDefaultThemeForRootLayout).toHaveBeenCalled();
  expect(html).toContain('data-testid="child"');
  expect(html).toContain('theme-boot');
});
```

Update the existing dark-theme test so it no longer expects `class="dark"` or `data-theme="dark"` on `<html>`. The theme boot script now applies those attributes on the client before hydration.

- [ ] **Step 2: Run the layout test and confirm failure**

Run: `npm run test -- 'src/app/[locale]/layout.test.ts'`

Expected: FAIL because `dynamic` is still exported and the root layout resolves theme before returning the document shell.

- [ ] **Step 3: Move request-bound theme resolution below `<Suspense>`**

In `src/app/[locale]/layout.tsx`, import `Suspense`:

```ts
import { Suspense } from 'react';
```

Remove:

```ts
import { getDefaultThemeForRootLayout } from '@/libs/theme-layout';
```

from the root import list and re-add it below the CSS import if the linter wants value imports grouped. Remove:

```ts
/** next-intl: per-request locale; do not use static build-time locale list. */
export const dynamic = 'force-dynamic';
```

Add this exported helper component above `RootLayout`:

```tsx
export async function RequestBoundBody(props: { children: React.ReactNode }) {
  const defaultTheme = await getDefaultThemeForRootLayout();

  return (
    <body>
      <SentryUserSync />
      <AppThemeProvider defaultTheme={defaultTheme}>
        <NextIntlClientProvider>{props.children}</NextIntlClientProvider>
      </AppThemeProvider>
      <Script id="theme-boot" strategy="beforeInteractive">
        {themeBootScript(defaultTheme)}
      </Script>
    </body>
  );
}
```

Update the return block in `RootLayout` so the root layout no longer awaits session/theme data before returning `<html>`:

```tsx
return (
  <html lang={locale} suppressHydrationWarning>
    <Suspense fallback={null}>
      <RequestBoundBody>{props.children}</RequestBoundBody>
    </Suspense>
  </html>
);
```

This intentionally opts the current single root layout out of the static shell while preserving user theme behavior. Splitting public and request-bound root layouts is a follow-on optimization after the cache slice lands.

- [ ] **Step 4: Run layout and build checks**

Run: `npm run test -- 'src/app/[locale]/layout.test.ts'`

Expected: PASS.

Run: `npm run build-local`

Expected: PASS. If Cache Components still reports uncached request data outside Suspense, stop and inspect the failing component before enabling `cacheComponents`.

---

### Task 5: Enable Next.js Cache Components And Register The Remote Handler

**Files:**
- Modify: `next.config.ts`
- Modify: `cache-handlers/next-cache-components.test.ts` if config shape requires path adjustment

- [ ] **Step 1: Add a failing config expectation**

If there is an existing Next config test, add these assertions there. If not, add them to a new `next.config.test.ts`:

```ts
const config = (await import('./next.config')).default;

expect(config.cacheComponents).toBe(true);
expect(config.cacheHandlers?.remote).toContain(
  'cache-handlers/next-cache-components.cjs'
);
```

- [ ] **Step 2: Run the config test and confirm failure**

Run: `npm run test -- next.config.test.ts`

Expected: FAIL because `cacheComponents` and `cacheHandlers.remote` are not configured.

- [ ] **Step 3: Update `next.config.ts` imports**

Add:

```ts
import path from 'node:path';
import { fileURLToPath } from 'node:url';
```

Add after `const isE2eBuild = process.env.IS_E2E === '1';`:

```ts
const projectDir = path.dirname(fileURLToPath(import.meta.url));
const nextCacheComponentsHandlerPath = path.join(
  projectDir,
  'cache-handlers',
  'next-cache-components.cjs'
);
```

- [ ] **Step 4: Enable Cache Components and handler tracing**

Update `baseConfig`:

```ts
cacheComponents: true,
cacheHandlers: {
  remote: nextCacheComponentsHandlerPath,
},
outputFileTracingIncludes: {
  '/*': ['./prisma/migrations/**/*', './cache-handlers/**/*'],
},
```

Preserve the existing `output: 'standalone'` and existing Prisma migration tracing.

- [ ] **Step 5: Run config and build checks**

Run: `npm run test -- next.config.test.ts cache-handlers/next-cache-components.test.ts`

Expected: PASS.

Run: `npm run build-local`

Expected: PASS and no `Invalid handler fields configured for "cacheHandlers"` error.

---

### Task 6: Add CMS Cache Tags And Remote-Cached CMS Reads

**Files:**
- Create: `src/libs/mit-sailing/cmsCache.ts`
- Modify: `src/libs/mit-sailing/cmsQueries.ts`
- Modify: `src/libs/mit-sailing/cmsQueries.test.ts`

- [ ] **Step 1: Create failing CMS cache tests**

In `src/libs/mit-sailing/cmsQueries.test.ts`, mock `next/cache`:

```ts
const cacheTags: string[] = [];
const cacheLives: unknown[] = [];

vi.mock('next/cache', () => ({
  cacheLife: (profile: unknown) => {
    cacheLives.push(profile);
  },
  cacheTag: (...tags: string[]) => {
    cacheTags.push(...tags);
  },
}));
```

Add tests:

```ts
import { cmsPagePathCacheTag } from '@/libs/mit-sailing/cmsCache';

it('tags cms menu cache entries by location', async () => {
  await loadCmsMenu('header');

  expect(cacheTags).toContain('cms-menu');
  expect(cacheTags).toContain('cms-menu:header');
  expect(cacheLives).toContainEqual({
    stale: 300,
    revalidate: 31_536_000,
    expire: 63_072_000,
  });
});

it('tags published cms pages by path', async () => {
  await loadPublishedCmsPageByPath('/about');

  expect(cacheTags).toContain('cms-page');
  expect(cacheTags).toContain(cmsPagePathCacheTag('/about'));
});
```

- [ ] **Step 2: Run the CMS tests and confirm failure**

Run: `npm run test -- src/libs/mit-sailing/cmsQueries.test.ts`

Expected: FAIL because the loaders do not call `cacheTag` or `cacheLife`.

- [ ] **Step 3: Create `cmsCache.ts`**

```ts
import { createHash } from 'node:crypto';
import type { CmsMenuLocation } from '@/libs/mit-sailing/cmsQueries';

export const cmsMenuCacheTag = 'cms-menu';
export const cmsPageCacheTag = 'cms-page';

export const cmsPublicContentCacheLife = {
  stale: 300,
  revalidate: 31_536_000,
  expire: 63_072_000,
};

export function cmsMenuLocationCacheTag(location: CmsMenuLocation): string {
  return `${cmsMenuCacheTag}:${location}`;
}

export function cmsPagePathCacheTag(path: string): string {
  const digest = createHash('sha256').update(path).digest('hex').slice(0, 32);
  return `${cmsPageCacheTag}:path:${digest}`;
}
```

- [ ] **Step 4: Update CMS menu loading to use remote cache**

In `src/libs/mit-sailing/cmsQueries.ts`, import:

```ts
import { cacheLife, cacheTag } from 'next/cache';
import {
  cmsMenuCacheTag,
  cmsMenuLocationCacheTag,
  cmsPageCacheTag,
  cmsPagePathCacheTag,
  cmsPublicContentCacheLife,
} from '@/libs/mit-sailing/cmsCache';
```

Rename the existing `loadCmsMenu` implementation to:

```ts
async function loadCmsMenuUnchecked(
  location: CmsMenuLocation
): Promise<PublicCmsMenuItem[]> {
  const menu = await prisma.cmsMenu.findUnique({
    where: { location },
    select: {
      items: {
        where: { isVisible: true },
        orderBy: [
          { parentId: 'asc' },
          { displayOrder: 'asc' },
          { label: 'asc' },
        ],
        select: {
          id: true,
          parentId: true,
          label: true,
          url: true,
          isExternal: true,
          systemKey: true,
          linkedPage: { select: { path: true } },
        },
      },
    },
  });
  return menu ? mapCmsMenuTree(menu.items) : [];
}
```

Add the exported wrapper:

```ts
export async function loadCmsMenu(
  location: CmsMenuLocation
): Promise<PublicCmsMenuItem[]> {
  'use cache: remote';
  cacheLife(cmsPublicContentCacheLife);
  cacheTag(cmsMenuCacheTag, cmsMenuLocationCacheTag(location));
  return loadCmsMenuUnchecked(location);
}
```

- [ ] **Step 5: Update CMS page loading to use remote cache**

Replace the React request-cache export:

```ts
export const loadPublishedCmsPageByPath = cache(
  loadPublishedCmsPageByPathUnchecked
);
```

with:

```ts
export async function loadPublishedCmsPageByPath(
  path: string
): Promise<PublicCmsPage | null> {
  'use cache: remote';
  cacheLife(cmsPublicContentCacheLife);
  cacheTag(cmsPageCacheTag, cmsPagePathCacheTag(path));
  return loadPublishedCmsPageByPathUnchecked(path);
}
```

Remove the `cache` import from `react` if it is no longer used in `cmsQueries.ts`.

- [ ] **Step 6: Run CMS tests**

Run: `npm run test -- src/libs/mit-sailing/cmsQueries.test.ts`

Expected: PASS.

---

### Task 7: Invalidate CMS Cache Tags From Admin Mutations

**Files:**
- Modify: `src/libs/admin/catalog/catalogActions.ts`
- Modify: `src/libs/admin/catalog/catalogActions.test.ts`

- [ ] **Step 1: Add failing invalidation assertions**

In the CMS menu mutation test:

```ts
expect(updateTag).toHaveBeenCalledWith('cms-menu');
```

In the CMS page mutation test:

```ts
expect(updateTag).toHaveBeenCalledWith('cms-page');
expect(updateTag).toHaveBeenCalledWith('cms-menu');
expect(updateTag).toHaveBeenCalledWith('sitemap-catalog');
```

- [ ] **Step 2: Run admin action tests and confirm failure**

Run: `npm run test -- src/libs/admin/catalog/catalogActions.test.ts`

Expected: FAIL because CMS cache tags are not updated.

- [ ] **Step 3: Import CMS cache tags**

In `src/libs/admin/catalog/catalogActions.ts`, add:

```ts
import {
  cmsMenuCacheTag,
  cmsPageCacheTag,
} from '@/libs/mit-sailing/cmsCache';
```

- [ ] **Step 4: Add broad CMS tag invalidation**

In `revalidateAfterCatalogMutation`, replace:

```ts
if (resourceId.startsWith('cms_')) {
  revalidatePath(getI18nPath('/', locale), 'layout');
}
```

with:

```ts
if (resourceId === 'cms_menus' || resourceId === 'cms_menu_items') {
  updateTag(cmsMenuCacheTag);
  revalidatePath(getI18nPath('/', locale), 'layout');
}
if (resourceId === 'cms_pages' || resourceId === 'cms_page_blocks') {
  updateTag(cmsPageCacheTag);
  updateTag(cmsMenuCacheTag);
  updateTag(sitemapCatalogCacheTag);
  revalidatePath(getI18nPath('/', locale), 'layout');
}
```

This starts with broad CMS tags because the existing generic catalog action does not always have a normalized menu location or page path at mutation time. CMS page mutations also invalidate menu cache because public menu DTOs include linked page paths. Narrow location/path tags can be added after catalog handlers expose the mutated location/path reliably.

- [ ] **Step 5: Run admin action tests**

Run: `npm run test -- src/libs/admin/catalog/catalogActions.test.ts`

Expected: PASS.

---

### Task 8: Include CMS Pages In Sitemap Cache

**Files:**
- Modify: `src/app/sitemap.ts`
- Modify: `src/app/sitemap.test.ts`
- Modify: `src/libs/mit-sailing/sitemapCache.ts`

- [ ] **Step 1: Add failing sitemap coverage for published CMS paths**

In `src/app/sitemap.test.ts`, add a Prisma mock for published CMS pages and assert `/about` appears in the generated sitemap:

```ts
it('includes published cms pages', async () => {
  prisma.cmsPage.findMany.mockResolvedValue([{ path: '/about' }]);

  const entries = await sitemap();

  expect(entries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ url: 'https://mitsailing.com/about' }),
    ])
  );
});
```

- [ ] **Step 2: Run sitemap tests and confirm failure**

Run: `npm run test -- src/app/sitemap.test.ts`

Expected: FAIL because `/sitemap.xml` does not include CMS page paths.

- [ ] **Step 3: Add a CMS path loader to `src/app/sitemap.ts`**

Add a cached slug/path loader next to the existing class/fleet/event loaders:

```ts
const getSitemapCmsPagePaths = unstable_cache(
  async () =>
    prisma.cmsPage.findMany({
      where: { isPublished: true },
      orderBy: [{ path: 'asc' }],
      select: { path: true },
    }),
  ['sitemap-cms-pages'],
  { revalidate: 86_400, tags: [sitemapCatalogCacheTag] }
);
```

Then include CMS paths in the sitemap entries:

```ts
const cmsPagePaths = await getSitemapCmsPagePaths();

for (const page of cmsPagePaths) {
  entries.push({
    url: absoluteUrl(page.path),
    lastModified: now,
  });
}
```

- [ ] **Step 4: Document CMS page invalidation in `sitemapCache.ts`**

Update the comment in `src/libs/mit-sailing/sitemapCache.ts` to state that `cms_pages` mutations must call `updateTag(sitemapCatalogCacheTag)` because published CMS paths appear in `/sitemap.xml`.

- [ ] **Step 5: Run sitemap tests**

Run: `npm run test -- src/app/sitemap.test.ts`

Expected: PASS.

---

### Task 9: Add Cache-Aware Readiness Without Making Public Liveness Fragile

**Files:**
- Modify: `src/libs/health/readiness.ts`
- Modify: `src/libs/health/readiness.test.ts`

- [ ] **Step 1: Add failing readiness test**

Add a test that passes `nextCacheRedisUrl` in the readiness env and expects a separate `nextCacheRedis` check in service mode:

```ts
expect(result.checks.nextCacheRedis).toMatchObject({
  status: 'ok',
  required: true,
});
```

- [ ] **Step 2: Run readiness tests and confirm failure**

Run: `npm run test -- src/libs/health/readiness.test.ts`

Expected: FAIL because readiness only checks `redis`.

- [ ] **Step 3: Extend readiness types**

Add to `ReadinessHealthResponse.checks`:

```ts
nextCacheRedis: DependencyHealth;
```

Add to `ReadinessEnv`:

```ts
nextCacheRedisUrl?: string;
```

In `defaultEnv()`:

```ts
nextCacheRedisUrl: Env.NEXT_CACHE_REDIS_URL,
```

- [ ] **Step 4: Run the cache Redis readiness check only for service readiness**

Use the same Redis checker as `redis`, but name the result `nextCacheRedis`. In public mode, report `skip` with `code: 'service_mode'`. In service mode for staging/production, require it.

The check construction should mirror the existing Redis check:

```ts
const { nextCacheRedisUrl } = env;
const nextCacheRedisPromise =
  mode === 'service'
    ? nextCacheRedisUrl
      ? measureCheck({
          required: isExternalDependencyRequired,
          timeoutMs,
          run: async (checkTimeoutMs) => {
            await checkers.redis(nextCacheRedisUrl, checkTimeoutMs);
          },
        })
      : Promise.resolve(skippedDependencyCheck(isExternalDependencyRequired))
    : Promise.resolve(serviceModeDependencyCheck());
```

- [ ] **Step 5: Run readiness tests**

Run: `npm run test -- src/libs/health/readiness.test.ts`

Expected: PASS.

---

### Task 10: Verify The First Russian-Doll Cache Layer In The Public Shell

**Files:**
- Modify only if tests expose type or cache-boundary failures:
  - `src/components/mit-sailing/SiteShellHeaderNav.tsx`
  - `src/components/mit-sailing/site/SiteFooter.tsx`
  - `src/libs/mit-sailing/cmsQueries.ts`

- [ ] **Step 1: Run focused public shell tests**

Run: `npm run test -- src/components/mit-sailing/SiteShellHeaderNav.test.ts src/libs/mit-sailing/cmsQueries.test.ts`

Expected: PASS.

- [ ] **Step 2: Check type compatibility with Cache Components**

Run: `npm run check:types`

Expected: PASS. If TypeScript rejects `'use cache: remote'` in this Next version, stop and inspect the installed `next/cache` type surface before changing the implementation.

- [ ] **Step 3: Run the local build**

Run: `npm run build-local`

Expected: PASS. This catches handler path and standalone tracing errors that unit tests cannot catch.

---

### Task 11: Final Verification

**Files:**
- `cache-handlers/next-cache-components.cjs`
- `cache-handlers/next-cache-components.test.ts`
- `next.config.ts`
- `compose.yaml`
- `compose.override.yaml`
- `compose.prod.yaml`
- `package.json`
- `.env.example`
- `.env.production.example`
- `.env.staging.example`
- `src/libs/Env.ts`
- `src/libs/Env.test.ts`
- `bin/deploy.sh`
- `src/libs/deploy/dockerComposeContract.test.ts`
- `src/libs/deploy/singleHostDeployScript.test.ts`
- `src/libs/health/readiness.ts`
- `src/libs/health/readiness.test.ts`
- `src/libs/mit-sailing/cmsCache.ts`
- `src/libs/mit-sailing/cmsQueries.ts`
- `src/libs/mit-sailing/cmsQueries.test.ts`
- `src/app/sitemap.ts`
- `src/app/sitemap.test.ts`
- `src/libs/mit-sailing/sitemapCache.ts`
- `src/libs/admin/catalog/catalogActions.ts`
- `src/libs/admin/catalog/catalogActions.test.ts`

- [ ] **Step 1: Run targeted tests**

Run: `npm run test -- src/libs/Env.test.ts cache-handlers/next-cache-components.test.ts src/app/sitemap.test.ts src/libs/admin/catalog/catalogActions.test.ts src/libs/mit-sailing/cmsQueries.test.ts src/libs/deploy/dockerComposeContract.test.ts src/libs/deploy/singleHostDeployScript.test.ts src/libs/health/readiness.test.ts`

Expected: PASS.

- [ ] **Step 2: Run required repo gates**

Run: `npm run lint`

Expected: PASS.

Run: `npm run check:types`

Expected: PASS.

Run: `npm run build-local`

Expected: PASS.

- [ ] **Step 3: Manual production-shape smoke check on the host or a staging clone**

Run the production Compose stack with both Redis services:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image up -d --no-recreate postgres redis redis_cache tusd media
docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image ps redis redis_cache
```

Expected: both services are healthy and have no published host ports.

Run:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image exec redis_cache redis-cli INFO memory
```

Expected: `maxmemory_policy:volatile-lru`.

- [ ] **Step 4: Admin edit smoke check**

With the app running on staging or the inactive production color, make a reversible CMS menu label edit in admin. Then request the public page through both web colors, not only the public hostname:

```bash
docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image exec -T web_blue node -e "const response = await fetch('http://127.0.0.1:3000/'); if (!response.ok) process.exit(1); process.stdout.write(await response.text());" >/tmp/mitsailing-home-blue.html
docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image exec -T web_green node -e "const response = await fetch('http://127.0.0.1:3000/'); if (!response.ok) process.exit(1); process.stdout.write(await response.text());" >/tmp/mitsailing-home-green.html
```

Expected: the edited menu label appears from both instances without rebuilding or redeploying. Repeat with a linked CMS page path edit and verify header/footer hrefs update.

---

## Follow-On Plan After This Lands

Do not fold these into the first PR unless the first PR is already green and small:

- Split `src/app/[locale]/layout.tsx` further so public pages can regain a static outer shell after the request-bound body boundary is proven.
- Cache class/fleet detail DTOs with remote tags, replacing the old `unstable_cache` helper where Cache Components fit cleanly.
- Split event detail pages into cached public event content plus request-bound registration/session state.
- Add per-location CMS menu invalidation when admin catalog handlers expose the affected `CmsMenu.location`.
- Add metrics or logs for Redis cache hit/miss and tag invalidation volume.
