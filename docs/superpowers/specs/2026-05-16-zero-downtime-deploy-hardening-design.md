# Zero-downtime deploy hardening design

## Context

Production deploys build one Docker image per `main` SHA and pin the stack through
`.env.image` as `APP_IMAGE=ghcr.io/mitsailing/mitsailing:sha-<short>`.
The app and BullMQ worker are intended to run the same pinned image.

The recent incident came from a manual worker recreate that loaded only
`.env.production`. Because the host had `APP_IMAGE=latest` there, the worker
drifted away from the pinned SHA and became unhealthy while the app stayed on
`sha-19d27c872388`. Recreating through the deploy path restored both services to
the same pinned image.

## Goals

- Keep `app` and `worker` on the same immutable SHA during every CI deploy.
- Make manual production commands harder to run with `APP_IMAGE=latest`.
- Fail deploys when either service is on the wrong image or unhealthy.
- Preserve web availability during deploys.
- Keep the worker single-instance unless a later design proves job processors
  are safe to run concurrently for this app.

## Non-goals

- Add a new orchestrator such as Kubernetes.
- Add automatic rollback or alerting in this change.
- Enable legacy MySQL sync; `LEGACY_MYSQL_SYNC_ENABLED=false` remains valid.
- Change database migration semantics.

## Recommended approach

Use pinned-image deployment as the source of truth and make `bin/deploy.sh`
enforce it.

The deploy script should always include `--env-file .env.image` after
`.env.production` so the pinned `APP_IMAGE` wins over any stale host value. The
server `.env.production` and `.env.production.example` should not define
`APP_IMAGE=latest`; image selection belongs to `.env.image`, which is rewritten
by `deploy.sh` for each deploy.

For zero downtime, the web tier cannot rely on the current one-container
`--force-recreate app` flow. The deploy should start new app capacity with the
pinned image, wait until every new app container is healthy and reports the
expected image, then remove old app capacity. This can be implemented within
Docker Compose by running two app replicas during the handoff, or by an explicit
blue/green pair if Compose service scaling proves too implicit for Cloudflare
Tunnel routing. The implementation plan should choose the smaller reliable
variant after validating how `cloudflared` resolves multiple `app` containers in
the production Compose network.

The worker does not serve traffic, so its availability requirement is different:
jobs must not be lost, and it must not drift to `latest`. After the web tier is
healthy on the new pinned image, the deploy should recreate `worker` with both
env files, wait for its healthcheck, and verify its `Config.Image` equals the
same `APP_IMAGE`.

## Deployment flow

1. `migrate <sha>` pins `.env.image`, pulls the SHA image, and runs Prisma
   migrations from the pinned image.
2. `deploy <sha>` pins `.env.image`, pulls the SHA image, and deploys the web
   tier with a zero-downtime handoff.
3. The script verifies every running app container uses exactly `$APP_IMAGE` and
   is healthy before proceeding.
4. The script recreates the worker with `.env.production` plus `.env.image`,
   waits for the worker healthcheck, and verifies the worker image.
5. CI fails if any image or health check does not match the requested SHA.

## Error handling

- Missing `.env.image` after pinning is a deploy-script bug and should fail.
- Any running `app` or `worker` container whose image is not `$APP_IMAGE` should
  fail the deploy.
- Any unhealthy `app` or `worker` container should fail the deploy and print the
  last container logs.
- Manual runbook commands should include `.env.image`; commands that omit it
  should be documented as unsafe for app/worker recreation.

## Testing

- Unit-test deploy helper behavior with shell-level tests if an existing shell
  test pattern exists; otherwise keep helper functions small and verify through
  a local dry-run Compose fixture.
- Run `npm run lint` and `npm run check:types` after code/docs edits.
- Validate the production-safe command shape on a non-production target or with
  local Compose before using it on `sailing-dock.mit.edu`.

## Documentation

Update `docs/deploy.md` with:

- `.env.image` is the only production source for `APP_IMAGE`.
- Do not recreate `app` or `worker` with only `.env.production`.
- Use deploy-script commands for production service recreation.
- A short check for whether production is on latest `main`: compare
  `git ls-remote origin refs/heads/main` to host `.env.image` and inspect
  `app`/`worker` container images.
