# Zero-downtime Deploy Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make production deploys keep `app` and `worker` on the same pinned SHA while preserving web availability during app rollout.

**Architecture:** Keep Docker Compose and the existing GHCR image pipeline. `bin/deploy.sh` becomes the single production mutation path: it writes `.env.image`, passes it to every Compose command after `.env.production`, starts an additional app replica on the new pinned image, verifies health and image identity, removes old app containers, then recreates and verifies the single worker. Documentation removes `APP_IMAGE=latest` from production env guidance and marks worker/app recreation without `.env.image` as unsafe.

**Tech Stack:** Bash, Docker Compose v2, GHCR images, Next.js standalone container, BullMQ worker, Vitest static deploy-contract tests.

---

## File Structure

- Modify `bin/deploy.sh`: centralize Compose invocation, include `.env.image`, add image verification, add service health waiting, deploy app with a two-replica handoff, then recreate and verify the worker.
- Modify `.env.production.example`: remove `APP_IMAGE=latest`; document `.env.image` as deploy-owned and require `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` before overlapping app replicas.
- Modify `src/libs/Env.ts`: validate `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` as an optional server env var so the production env example stays aligned with repo policy.
- Modify `src/libs/Env.test.ts`: cover the new optional Server Actions encryption key.
- Modify `docs/deploy.md`: document pinned image rules, safe manual commands, latest-main verification, and the one-time cleanup for host `.env.production`.
- Create `src/libs/deploy/deployScript.test.ts`: static contract tests that prevent regressions in the deploy-script safety properties without requiring Docker in unit tests.

## Task 1: Add Deploy Script Contract Tests

**Files:**
- Create: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/libs/deploy/deployScript.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('production deploy script', () => {
  const root = process.cwd();
  const deployScript = readFileSync(join(root, 'bin/deploy.sh'), 'utf8');
  const productionEnvExample = readFileSync(
    join(root, '.env.production.example'),
    'utf8'
  );
  const deployRunbook = readFileSync(join(root, 'docs/deploy.md'), 'utf8');

  it('uses the pinned image env file for compose commands', () => {
    expect(deployScript).toContain(
      'readonly IMAGE_ENV_FILE="${DEPLOY_IMAGE_ENV_FILE:-.env.image}"'
    );
    expect(deployScript).toContain('--env-file "$IMAGE_ENV_FILE"');
    expect(deployScript).toContain('compose()');
  });

  it('verifies app and worker images after deployment', () => {
    expect(deployScript).toContain('verify_service_image app "$APP_IMAGE"');
    expect(deployScript).toContain('verify_service_image worker "$APP_IMAGE"');
    expect(deployScript).toContain('{{.Config.Image}}');
  });

  it('waits for app and worker healthchecks', () => {
    expect(deployScript).toContain('wait_for_service_health app "$ref"');
    expect(deployScript).toContain('wait_for_service_health worker "$ref"');
    expect(deployScript).toContain('{{.State.Health.Status}}');
  });

  it('deploys app capacity before removing old app containers', () => {
    expect(deployScript).toContain('deploy_app_zero_downtime');
    expect(deployScript).toContain('--scale "app=${APP_SCALE_DURING_DEPLOY}"');
    expect(deployScript).toContain('remove_old_app_containers "$APP_IMAGE"');
  });

  it('keeps latest out of production app image configuration', () => {
    expect(productionEnvExample).not.toContain('APP_IMAGE=');
    expect(productionEnvExample).toContain(
      'APP_IMAGE is written to .env.image by bin/deploy.sh'
    );
    expect(deployRunbook).toContain(
      'Do not recreate app or worker with only `.env.production`'
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: FAIL because `src/libs/deploy/deployScript.test.ts` references deploy-script contracts that are not implemented yet.

- [ ] **Step 3: Commit the failing test**

Run:

```bash
git add src/libs/deploy/deployScript.test.ts
git commit -m "test: cover production deploy script contracts"
```

## Task 2: Make `.env.image` Authoritative in `bin/deploy.sh`

**Files:**
- Modify: `bin/deploy.sh`
- Test: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Add image env constants and a shared Compose wrapper**

In `bin/deploy.sh`, replace the env-file constant block:

```bash
readonly COMPOSE_FILES="${DEPLOY_COMPOSE_FILES:--f compose.yaml -f compose.prod.yaml}"
readonly ENV_FILE="${DEPLOY_ENV_FILE:-.env.production}"
readonly IMAGE_ENV_FILE="${DEPLOY_IMAGE_ENV_FILE:-.env.image}"
readonly HEALTHCHECK_TIMEOUT_SECONDS="${DEPLOY_HEALTHCHECK_TIMEOUT_SECONDS:-90}"
readonly APP_SCALE_DURING_DEPLOY="${DEPLOY_APP_SCALE_DURING_DEPLOY:-2}"
readonly CMS_MEDIA_VOLUME_NAME="mitsailing_cms_media"
readonly CMS_MEDIA_TARGET="/var/lib/mitsailing/cms-media"
readonly CMS_MEDIA_RUNTIME_UID_GID="1001:1001"
```

After `fail()`, add:

```bash
compose() {
  # shellcheck disable=SC2086
  docker compose $COMPOSE_FILES --env-file "$ENV_FILE" --env-file "$IMAGE_ENV_FILE" "$@"
}
```

- [ ] **Step 2: Require `.env.image` after pinning**

Replace `ensure_prereqs()` with:

```bash
ensure_prereqs() {
  [[ -f compose.yaml && -f compose.prod.yaml ]] \
    || fail "compose files missing in $DEPLOY_DIR — re-run the bootstrap from docs/deploy.md"
  [[ -f "$ENV_FILE" ]] \
    || fail "${ENV_FILE} missing in $DEPLOY_DIR — copy .env.production.example and fill it in"
}

ensure_image_env_file() {
  [[ -f "$IMAGE_ENV_FILE" ]] \
    || fail "${IMAGE_ENV_FILE} missing after pinning image"
}
```

At the end of `pin_image()`, after `docker pull "$image"`, add:

```bash
  ensure_image_env_file
```

- [ ] **Step 3: Use the Compose wrapper in existing helpers**

In `bin/deploy.sh`, replace existing `docker compose $COMPOSE_FILES --env-file "$ENV_FILE"` invocations for project services with `compose`. For example:

```bash
container=$(compose ps -q "$service")
```

```bash
compose up -d postgres
```

```bash
compose run --rm --no-deps app node ./node_modules/prisma/build/index.js migrate deploy
```

- [ ] **Step 4: Run the targeted deploy contract test**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: still FAIL because image verification, health waiting, app handoff, and docs are not implemented yet.

## Task 3: Add Image and Health Verification Helpers

**Files:**
- Modify: `bin/deploy.sh`
- Test: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Add service inspection helpers**

In `bin/deploy.sh`, after `verify_cms_media_mounts()`, add:

```bash
service_containers() {
  local service="$1"
  compose ps -q "$service"
}

container_health_status() {
  local container="$1"
  docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container" 2>/dev/null || echo "missing"
}

container_image() {
  local container="$1"
  docker inspect --format '{{.Config.Image}}' "$container"
}

print_service_logs() {
  local service="$1"
  local container
  for container in $(service_containers "$service"); do
    log "$service container $container logs tail:"
    docker logs --tail 50 "$container" >&2 || true
  done
}
```

- [ ] **Step 2: Add image verification**

In `bin/deploy.sh`, after the helpers from Step 1, add:

```bash
verify_service_image() {
  local service="$1"
  local expected_image="$2"
  local containers container actual_image
  containers="$(service_containers "$service")"
  [[ -n "$containers" ]] || fail "$service container did not start"

  for container in $containers; do
    actual_image="$(container_image "$container")"
    [[ "$actual_image" == "$expected_image" ]] \
      || fail "$service container $container image mismatch: expected $expected_image, actual $actual_image"
  done
  log "$service image verified as $expected_image"
}
```

- [ ] **Step 3: Add generic health waiting**

In `bin/deploy.sh`, after `verify_service_image()`, add:

```bash
wait_for_service_health() {
  local service="$1"
  local ref="$2"
  local deadline status container all_healthy
  deadline=$((SECONDS + HEALTHCHECK_TIMEOUT_SECONDS))

  while (( SECONDS < deadline )); do
    all_healthy=true
    for container in $(service_containers "$service"); do
      status="$(container_health_status "$container")"
      if [[ "$status" != "healthy" ]]; then
        all_healthy=false
      fi
    done
    if [[ -n "$(service_containers "$service")" && "$all_healthy" == true ]]; then
      log "$service is healthy (ref=$ref)"
      return
    fi
    sleep 2
  done

  log "$service did not reach healthy within ${HEALTHCHECK_TIMEOUT_SECONDS}s"
  print_service_logs "$service"
  fail "$service failed healthcheck"
}
```

- [ ] **Step 4: Replace the app-only health function**

Remove `wait_for_app_health()` and update callers later to use:

```bash
wait_for_service_health app "$ref"
```

```bash
wait_for_service_health worker "$ref"
```

- [ ] **Step 5: Run the targeted deploy contract test**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: still FAIL because app handoff and docs are not implemented yet.

## Task 4: Implement App Handoff and Worker Recreate

**Files:**
- Modify: `bin/deploy.sh`
- Test: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Add app handoff helpers**

In `bin/deploy.sh`, after `wait_for_service_health()`, add:

```bash
wait_for_new_app_capacity() {
  local expected_image="$1"
  local ref="$2"
  local deadline container status actual_image
  deadline=$((SECONDS + HEALTHCHECK_TIMEOUT_SECONDS))

  while (( SECONDS < deadline )); do
    for container in $(service_containers app); do
      actual_image="$(container_image "$container")"
      status="$(container_health_status "$container")"
      if [[ "$actual_image" == "$expected_image" && "$status" == "healthy" ]]; then
        log "new app capacity is healthy (container=$container ref=$ref)"
        return
      fi
    done
    sleep 2
  done

  log "new app capacity did not become healthy within ${HEALTHCHECK_TIMEOUT_SECONDS}s"
  print_service_logs app
  fail "new app capacity failed healthcheck"
}

remove_old_app_containers() {
  local expected_image="$1"
  local container actual_image
  for container in $(service_containers app); do
    actual_image="$(container_image "$container")"
    if [[ "$actual_image" != "$expected_image" ]]; then
      log "removing old app container $container with image $actual_image"
      docker rm --force "$container" >/dev/null
    fi
  done
}
```

- [ ] **Step 2: Add the zero-downtime app deploy function**

Replace `run_deploy()` with:

```bash
deploy_app_zero_downtime() {
  local image="$1"
  local ref="$2"
  log "starting app handoff with image $image"

  compose up \
    --detach \
    --no-deps \
    --no-recreate \
    --pull always \
    --scale "app=${APP_SCALE_DURING_DEPLOY}" \
    app

  wait_for_new_app_capacity "$image" "$ref"
  remove_old_app_containers "$image"
  wait_for_service_health app "$ref"
  verify_service_image app "$APP_IMAGE"
  verify_cms_media_mount app
}

deploy_worker() {
  local image="$1"
  local ref="$2"
  log "recreating worker with image $image"

  compose up \
    --detach \
    --no-deps \
    --force-recreate \
    --pull always \
    worker

  wait_for_service_health worker "$ref"
  verify_service_image worker "$APP_IMAGE"
  verify_cms_media_mount worker
}

run_deploy() {
  local image="$1"
  local ref="$2"
  log "deploying services with image $image"

  deploy_app_zero_downtime "$image" "$ref"
  deploy_worker "$image" "$ref"
}
```

- [ ] **Step 3: Update the deploy caller**

In `main()`, replace:

```bash
run_deploy "$APP_IMAGE"
wait_for_app_health "$ref"
```

with:

```bash
run_deploy "$APP_IMAGE" "$ref"
docker image prune --force --filter 'until=168h' >/dev/null || true
```

- [ ] **Step 4: Run the targeted deploy contract test**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: still FAIL only on `.env.production.example` and `docs/deploy.md` assertions.

## Task 5: Validate the Server Actions Encryption Env Var and Remove `APP_IMAGE=latest`

**Files:**
- Modify: `.env.production.example`
- Modify: `src/libs/Env.ts`
- Modify: `src/libs/Env.test.ts`
- Test: `src/libs/deploy/deployScript.test.ts`
- Test: `src/libs/Env.test.ts`

- [ ] **Step 1: Replace the production image section**

In `.env.production.example`, replace:

```dotenv
# ───── Image (overwritten on each deploy by deploy.sh → .env.image) ─────
# CI publishes `latest` and `sha-<12 hex chars>`. Local defaults are fine.
APP_IMAGE=ghcr.io/mitsailing/mitsailing:latest
```

with:

```dotenv
# ───── Image (deploy-owned) ─────
# APP_IMAGE is written to .env.image by bin/deploy.sh on every production
# migrate/deploy command. Do not set APP_IMAGE in .env.production; doing so can
# cause manual docker compose commands to recreate app or worker from `latest`.
```

- [ ] **Step 2: Make the zero-downtime key requirement explicit**

In `.env.production.example`, replace:

```dotenv
# Before running more than one `app` replica (or overlapping rolling deploys),
# set a shared AES key (https://nextjs.org/docs/app/guides/data-security):
# NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=
```

with:

```dotenv
# Required before zero-downtime deploys because app replicas can overlap during
# a handoff. Generate once and keep stable across production app containers.
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=
```

- [ ] **Step 3: Write the failing env validation test**

In `src/libs/Env.test.ts`, after `it('defaults legacy MySQL sync to disabled with an hourly cron', ...)`, add:

```ts
  it('accepts a server actions encryption key for overlapping deploys', async () => {
    stubRequiredBaseEnv();
    vi.stubEnv(
      'NEXT_SERVER_ACTIONS_ENCRYPTION_KEY',
      'test-server-actions-encryption-key'
    );

    const { Env } = await import('@/libs/Env');

    expect(Env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY).toBe(
      'test-server-actions-encryption-key'
    );
  });
```

- [ ] **Step 4: Run the env test to verify it fails**

Run:

```bash
npm run test -- --run src/libs/Env.test.ts
```

Expected: FAIL because `Env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` is not defined yet.

- [ ] **Step 5: Add the env var to `Env.ts`**

In `src/libs/Env.ts`, add this server field after `CMS_MEDIA_ROOT`:

```ts
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY: z.string().min(1).optional(),
```

Add this runtime env mapping after `CMS_MEDIA_ROOT: process.env.CMS_MEDIA_ROOT,`:

```ts
    NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:
      process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY,
```

- [ ] **Step 6: Run the env test to verify it passes**

Run:

```bash
npm run test -- --run src/libs/Env.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the targeted deploy contract test**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: still FAIL only on `docs/deploy.md` assertions.

## Task 6: Update the Production Deploy Runbook

**Files:**
- Modify: `docs/deploy.md`
- Test: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Document `.env.image` ownership**

In `docs/deploy.md`, in the `.env.production` setup section near the runtime variables, add:

```markdown
Do not set `APP_IMAGE` in `.env.production`. `bin/deploy.sh` writes the pinned
image to `.env.image` on every `migrate <sha>` and `deploy <sha>` command, and
the deploy script passes `.env.image` after `.env.production` so the pinned SHA
wins. If the host currently has `APP_IMAGE=ghcr.io/mitsailing/mitsailing:latest`
in `.env.production`, remove that line.
```

- [ ] **Step 2: Document safe manual service recreation**

In `docs/deploy.md`, near the worker schedule recreate command, replace commands that omit `.env.image` with:

```bash
docker compose -f compose.yaml -f compose.prod.yaml \
  --env-file .env.production --env-file .env.image --env-file .env.production.worker \
  up -d --force-recreate worker
```

Add immediately after the command:

```markdown
Do not recreate app or worker with only `.env.production`. That bypasses the
pinned `.env.image` file and can recreate a service from `latest` if a stale
host env file still contains `APP_IMAGE=latest`.
```

- [ ] **Step 3: Add latest-main verification commands**

In the troubleshooting section of `docs/deploy.md`, add:

````markdown
### Verify production is on latest main

From a local checkout:

```bash
git ls-remote origin refs/heads/main
ssh ak@sailing-dock.mit.edu 'cd ~/apps/mitsailing && sed -n "s/^APP_IMAGE=//p" .env.image && docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep "^mitsailing-"'
```

The short SHA in `.env.image` should match the first 12 characters of
`origin/main`, and both `mitsailing-app-*` and `mitsailing-worker-*` should use
that same image.
````

- [ ] **Step 4: Run the targeted deploy contract test**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
```

Expected: PASS.

## Task 7: Verify and Commit the Implementation

**Files:**
- Modify: `bin/deploy.sh`
- Modify: `.env.production.example`
- Modify: `docs/deploy.md`
- Modify: `src/libs/Env.ts`
- Modify: `src/libs/Env.test.ts`
- Create: `src/libs/deploy/deployScript.test.ts`

- [ ] **Step 1: Run allowed verification commands**

Run:

```bash
npm run test -- --run src/libs/deploy/deployScript.test.ts
npm run test -- --run src/libs/Env.test.ts
npm run lint
npm run check:types
```

Expected:

```text
PASS src/libs/deploy/deployScript.test.ts
PASS src/libs/Env.test.ts
```

`npm run lint` and `npm run check:types` should exit with status 0.

- [ ] **Step 2: Review the deploy script diff**

Run:

```bash
git diff -- bin/deploy.sh .env.production.example docs/deploy.md src/libs/Env.ts src/libs/Env.test.ts src/libs/deploy/deployScript.test.ts
```

Expected: the diff only changes deploy hardening, production image docs, env validation for `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`, and the deploy contract test.

- [ ] **Step 3: Commit**

Run:

```bash
git add bin/deploy.sh .env.production.example docs/deploy.md src/libs/Env.ts src/libs/Env.test.ts src/libs/deploy/deployScript.test.ts
git commit -m "fix: harden production deploy image pinning"
```

## Task 8: Production Operator Cleanup After Merge

**Files:**
- No repo files.
- Production host: `ak@sailing-dock.mit.edu`

- [ ] **Step 1: Remove stale `APP_IMAGE` from host `.env.production`**

After the hardening commit is merged and deployed, run on the production host:

```bash
ssh ak@sailing-dock.mit.edu 'cd ~/apps/mitsailing && cp .env.production .env.production.bak.$(date -u +%Y%m%dT%H%M%SZ) && sed -i "/^APP_IMAGE=/d" .env.production'
```

Expected: command exits 0 and creates a timestamped backup before editing.

- [ ] **Step 2: Verify pinned images on production**

Run:

```bash
git ls-remote origin refs/heads/main
ssh ak@sailing-dock.mit.edu 'cd ~/apps/mitsailing && sed -n "s/^APP_IMAGE=//p" .env.image && docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" | grep "^mitsailing-"'
```

Expected: `.env.image`, `mitsailing-app-*`, and `mitsailing-worker-1` all use the `sha-<12>` tag matching current `origin/main`; app and worker are healthy.

- [ ] **Step 3: Validate Docker DNS for app replicas before relying on zero downtime**

Run during a low-traffic window after the deploy-script change is present:

```bash
ssh ak@sailing-dock.mit.edu 'cd ~/apps/mitsailing && docker run --rm --network mitsailing_internal alpine:3.20 sh -c "apk add --no-cache bind-tools >/dev/null && nslookup app"'
```

Expected: DNS lookup returns at least one `app` address. During a deploy handoff with two app replicas, it should return both app replica addresses. If it does not, pause and switch to an explicit proxy/blue-green design before relying on the handoff for zero downtime.
