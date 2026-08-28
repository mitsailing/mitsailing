# DevOps Plan

The production target is a Docker-only MIT Sailing stack on the production host.
WordPress is a separate stack and tunnel at `wp.mitsailing.com`; do not connect
this app to that tunnel or compose network.

## Principles

- No host nginx or host cloudflared installs.
- Persistent state uses host bind mounts under `/srv/mitsailing-data`.
- One MIT Sailing Cloudflare Tunnel routes `mitsailing.com`.
- App deploys are zero-downtime through Dockerized nginx switching between
  `web_blue` and `web_green`.
- Upload/media services are stable during app deploys and restarted only during
  explicit maintenance windows.

## Services

| Service | Role |
| --- | --- |
| `cloudflared` | MIT Sailing tunnel connector |
| `app` | Dockerized nginx app ingress |
| `web_blue`, `web_green` | Next.js standalone app containers |
| `postgres` | Production database |
| `redis` | BullMQ queue |
| `mailpit` | SMTP capture and authenticated `/mail/` review UI |
| `tusd` | Resumable upload server |
| `worker` | BullMQ worker/media processor |
| `media` | nginx for ready CMS files |

## Cloudflare Routing

Configure the MIT Sailing tunnel separately from WordPress:

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

Postgres and Redis are never public Cloudflare origins.

Mailpit is also not a public Cloudflare origin. It listens only on the Docker
network, app nginx proxies `/mail/` to `mailpit:8025` with Mailpit
`MP_WEBROOT=/mail/`, and the app sends all staging mail to Mailpit over SMTP.

Mailpit owns selective pass-through with `MP_SMTP_RELAY_MATCHING` and Resend
SMTP relay settings. The website does not inspect recipients or decide whether a
message leaves Mailpit.

Protect `/mail/` with Mailpit basic auth (`MAILPIT_UI_AUTH`).

## Deploy Model

`bin/deploy.sh release <image-tag>` is the production deployment entrypoint.
It starts data services, runs migrations, starts the inactive web color,
readiness-checks it, switches nginx, restarts the worker, then drains the old
web color.

Use media maintenance commands separately:

- `bin/deploy.sh media-maintenance <image-tag>` when `docker/nginx/media.conf`
  changes.
- `bin/deploy.sh tusd-maintenance <image-tag>` when tusd config/image/upload
  semantics change.

Restarting `tusd` can interrupt uploads, so schedule tusd maintenance at night.

## No-Sudo Boundary

The deploy user needs Docker access. It can create files under
`~/apps/mitsailing` and run Docker Compose. It cannot install packages, bind
privileged ports directly, create `/srv`, inspect locked-down production data
paths directly, or enable rootless Docker linger.

Ask an admin only for host prerequisites such as Docker installation,
`/srv/mitsailing-data` ownership and ACLs, and, if needed,
`loginctl enable-linger DEPLOY_USER`.
