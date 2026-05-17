# Media and Upload Maintenance

This policy covers the MIT Sailing app stack only. WordPress at
`wp.mitsailing.com` is a separate stack and tunnel; do not touch it from this
runbook.

Normal app releases must keep media serving and active uploads stable. The
production deploy script starts `postgres`, `redis`, `tusd`, and `media` with
`--no-recreate` during app releases, then switches web traffic through
Dockerized nginx. Restart `tusd` or media nginx only with the explicit
maintenance commands below.

## Current Topology

Cloudflare routes one public hostname to three in-stack origins. Rule order is
load-bearing:

```yaml
ingress:
  - hostname: mitsailing.com
    path: ^/cms-media/uploads(/.*)?$
    service: http://tusd:1080

  - hostname: mitsailing.com
    path: ^/cms-media(/.*)?$
    service: http://media:8080

  - hostname: mitsailing.com
    service: http://app:3000

  - service: http_status:404
```

`/cms-media/uploads/*` must match before `/cms-media/*`; otherwise upload
traffic reaches static media nginx and fails as 404/405 instead of tus.

Production media state lives in the host bind mount
`/srv/mitsailing-data/cms-media`, mounted in containers at
`/var/lib/mitsailing/cms-media`:

| Path | Owner | Purpose |
| --- | --- | --- |
| `uploads/` | `tusd` | Raw resumable uploads, keyed by asset id |
| `ready/` | `worker` writes, `media` reads | Public CMS files served at `/cms-media/*` |

The media nginx container serves `ready/` through `/cms-media/*` and exposes
`/cms-media/healthz`. Ready files are cached as immutable for one year, so do
not overwrite public ready files in place. Fixes should create a new asset path.

## Upload Lifecycle

1. Admin UI requests an upload session from the app.
2. The app creates a DB-backed CMS media asset and returns signed tus metadata.
3. Browser uploads bytes directly to `https://mitsailing.com/cms-media/uploads/`.
4. `tusd` calls the app hook at
   `https://mitsailing.com/api/internal/cms-media/tusd/hooks` before accepting a
   create request.
5. Finalize checks tus upload status with `HEAD /cms-media/uploads/<assetId>`.
6. The worker validates the file, moves it from `uploads/` to `ready/`, and
   marks the DB asset ready.
7. Public pages reference `/cms-media/<assetId>/<filename>`.

Running containers are not enough to prove uploads work. The hook endpoint,
Cloudflare route order, DB, Redis, worker, and media volume all need to remain
consistent.

## When To Use Maintenance Commands

Use normal `bin/deploy.sh release <image-tag>` for:

- app code changes;
- worker code changes;
- migrations that remain backward-compatible across overlapping web versions;
- CMS UI changes;
- ordinary content/admin releases.

Use `media-maintenance <image-tag>` only when:

- `docker/nginx/media.conf` changes;
- the media nginx image or static serving config changes;
- the `/cms-media/healthz` behavior changes.

Use `tusd-maintenance <image-tag>` only when:

- `tusproject/tusd` image version changes;
- tusd command flags change;
- `MEDIA_UPLOAD_MAX_BYTES` changes;
- upload CORS behavior changes;
- `TUSD_HOOKS_HTTP_URL` or forwarded hook headers change;
- upload storage path, volume mount, or tus protocol behavior changes.

Use the current deployed app image tag unless intentionally changing it. On the
host, read it before running maintenance:

```bash
export PRODUCTION_SSH_TARGET=deploy@example.com

ssh "$PRODUCTION_SSH_TARGET" 'cat apps/mitsailing/.deploy/current_ref'
```

Use that concrete tag, such as `sha-abc123def456`, in the commands below. Avoid
`latest` unless you intentionally want `.env.image` to point at the floating
GHCR tag.

## Preflight

Run media or tusd maintenance at night or during a confirmed low-traffic window.
Before starting:

- confirm no staff are expected to upload CMS media during the window;
- confirm the current GitHub deploy files have been synced to
  `~/apps/mitsailing`;
- confirm `.env.production` values for `MEDIA_UPLOAD_BASE_URL`,
  `MEDIA_PUBLIC_BASE_URL`, `MEDIA_STORAGE_ROOT`,
  `MEDIA_UPLOAD_SHARED_SECRET`, and `TUSD_HOOKS_HTTP_URL`;
- confirm Cloudflare Tunnel route order matches the rules above;
- confirm the latest backup/restore policy covers
  `/srv/mitsailing-data/cms-media` if storage layout changes;
- check the current stack state:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'cd apps/mitsailing && docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image ps'
```

Tail logs in another terminal:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'cd apps/mitsailing && docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image logs -f --tail 100 tusd media worker app cloudflared'
```

## Commands

Restart static media nginx:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh media-maintenance sha-abc123def456'
```

Restart tusd:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'DEPLOY_DIR=apps/mitsailing apps/mitsailing/bin/deploy.sh tusd-maintenance sha-abc123def456'
```

Expected impact:

- `media-maintenance` can briefly interrupt public CMS media responses.
- `tusd-maintenance` can interrupt active uploads. Users may need to retry or
  resume. Some DB assets may remain `uploading` until the user retries and
  finalizes.
- App traffic should remain up unless Cloudflare routing, the tusd hook endpoint,
  DB, Redis, or the active app container is unhealthy.

## Verification

Run these after either maintenance command:

```bash
curl -fsSI https://mitsailing.com/api/health/live
curl -fsSI -X OPTIONS https://mitsailing.com/cms-media/uploads/
curl -fsSI https://mitsailing.com/cms-media/healthz
```

After `tusd-maintenance`, also perform one authenticated CMS upload from the
admin UI and verify the resulting public `/cms-media/<assetId>/<filename>` URL
loads.

If the operator has access to `HEALTHCHECK_SECRET`, also verify protected
readiness from the host and confirm `mediaUpload.status = ok` and
`mediaPublic.status = ok`:

```bash
ssh "$PRODUCTION_SSH_TARGET" 'cd apps/mitsailing && set -a && . ./.env.production && set +a && curl -fsS -H "Authorization: Bearer ${HEALTHCHECK_SECRET}" https://mitsailing.com/api/health/ready'
```

## Recovery

If media nginx fails:

1. Inspect `media` logs.
2. Revert the `docker/nginx/media.conf` or image change.
3. Re-sync deploy files if needed.
4. Re-run `media-maintenance` with the last known good image tag.
5. Re-run `/cms-media/healthz` and a known media URL check.

If tusd fails:

1. Inspect `tusd`, `app`, `worker`, and `cloudflared` logs.
2. Verify Cloudflare routes still send `/cms-media/uploads/*` to `tusd`.
3. Verify the hook endpoint is reachable through `mitsailing.com`.
4. Revert tusd flags/env/image changes.
5. Re-run `tusd-maintenance` with the last known good image tag.
6. Re-run OPTIONS and a real authenticated upload.

Do not use `bin/deploy.sh rollback` as a media data recovery tool. Rollback
switches app/worker image traffic only; it does not restore
`/srv/mitsailing-data/cms-media`, delete raw uploads, undo ready files, or
reverse database migrations.

## Data Hygiene

Do not manually delete or rewrite `uploads/`, `ready/`, CMS media DB rows, or
queued jobs during routine maintenance. Those states are coupled. Cleanup of
stale uploads or failed media records needs a separate tested procedure.

Do not expose Postgres, Redis, tusd, or media nginx with host ports for
maintenance. Access should remain through Docker Compose and the MIT Sailing
Cloudflare Tunnel.

## References

- [Production deploy runbook](deploy.md)
- [DevOps plan](devops_plan.md)
- [Cloudflare Tunnel ingress matching](https://github.com/cloudflare/cloudflare-docs/blob/production/src/content/partials/cloudflare-one/tunnel/locally-managed/configuration-file.mdx)
- [tusd project](https://github.com/tus/tusd)
- [Docker NGINX image](https://github.com/nginx/docker-nginx)
