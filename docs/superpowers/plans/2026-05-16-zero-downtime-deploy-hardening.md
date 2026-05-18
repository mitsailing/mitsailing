# Zero-downtime Docker Media and Deploy Hardening Implementation Plan

> **Superseded.** This historical implementation plan was replaced before the
> MIT Sailing app went live. It is intentionally reduced to this notice so
> agents do not restore deleted deploy files, alternate media hostnames, or
> host-level storage assumptions from the retired design.

Current source of truth:

- [`../../deploy.md`](../../deploy.md)
- [`../../devops_plan.md`](../../devops_plan.md)

Current production decisions:

- One Docker Compose stack runs on `deploy@example.com`.
- Host bind mounts under `/srv/mitsailing-data` hold Postgres, Redis, and CMS media.
- The MIT Sailing Cloudflare Tunnel routes same-origin `mitsailing.com` paths to
  app, upload, and media services.
- There is no host-installed nginx or host-installed cloudflared requirement.
- WordPress remains separate and untouched at `wp.mitsailing.com`.
