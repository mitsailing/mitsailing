# Media Maintenance

Use this only for exceptional CMS media or tusd work. Normal app deploys run
through GitHub Actions. WordPress at `wp.mitsailing.com` is separate.

## Decide

Use GitHub Actions `Deploy (production)` for app, worker, CMS UI, and migration
changes.

Use `media-maintenance` only for static media service changes:

- `docker/nginx/media.conf`
- media nginx image or health check changes
- `/cms-media/healthz` behavior

Use `tusd-maintenance` only for upload service changes:

- tusd image, flags, upload size, CORS, hook URL, hook header, storage mount, or
  tus protocol changes
- a quiet window, because active uploads can be interrupted

## Preflight

Use the current deployed app image unless the maintenance intentionally changes
an image:

```bash
export PRODUCTION_SSH_TARGET=ak@sailing-dock.mit.edu
export PRODUCTION_DATA_ROOT=/home/ak/mitsailing-data
export DEPLOY_DIR=apps/mitsailing
export IMAGE_TAG="$(ssh "$PRODUCTION_SSH_TARGET" "cat $DEPLOY_DIR/.deploy/current_ref")"
```

Check the stack and recent logs:

```bash
ssh "$PRODUCTION_SSH_TARGET" \
  "cd $DEPLOY_DIR && PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image ps"

ssh "$PRODUCTION_SSH_TARGET" \
  "cd $DEPLOY_DIR && PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image logs --tail 100 tusd media worker app cloudflared"
```

Before `tusd-maintenance`, confirm no CMS upload is in progress.

## Run

Restart static media nginx:

```bash
ssh "$PRODUCTION_SSH_TARGET" \
  "PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' DEPLOY_DIR=$DEPLOY_DIR $DEPLOY_DIR/bin/deploy.sh media-maintenance '$IMAGE_TAG'"
```

Restart tusd:

```bash
ssh "$PRODUCTION_SSH_TARGET" \
  "PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' DEPLOY_DIR=$DEPLOY_DIR $DEPLOY_DIR/bin/deploy.sh tusd-maintenance '$IMAGE_TAG'"
```

## Verify

```bash
curl -fsSI https://mitsailing.com/api/health/live
curl -fsSI https://mitsailing.com/cms-media/healthz
curl -fsSI -X OPTIONS https://mitsailing.com/cms-media/uploads/
```

After `tusd-maintenance`, upload one CMS file from the admin UI and open the
resulting `/cms-media/<assetId>/<filename>` URL.

## Recover

Inspect logs first:

```bash
ssh "$PRODUCTION_SSH_TARGET" \
  "cd $DEPLOY_DIR && PRODUCTION_DATA_ROOT='$PRODUCTION_DATA_ROOT' docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image logs --tail 150 tusd media worker app cloudflared"
```

For media nginx, revert the media config or image, rerun `media-maintenance`,
then check `/cms-media/healthz`.

For tusd, revert the tusd image, flag, env, route, or mount change, rerun
`tusd-maintenance`, then test OPTIONS and a real upload.

Do not use `bin/deploy.sh rollback` for media recovery. Rollback switches app
traffic only; it does not restore CMS media files or undo media service config.
