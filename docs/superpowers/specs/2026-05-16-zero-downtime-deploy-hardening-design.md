# Zero-downtime deploy hardening design

> **Superseded.** This historical design was replaced before the MIT Sailing app
> went live. It is intentionally reduced to this notice so agents do not restore
> deleted deploy files, alternate media hostnames, or host-level storage
> assumptions from the retired design.

Current source of truth:

- [`../../deploy.md`](../../deploy.md)
- [`../../devops_plan.md`](../../devops_plan.md)

Current production decisions:

- One Docker Compose stack runs on `deploy@example.com`.
- Dockerized nginx switches between blue and green app containers for app
  release continuity.
- The MIT Sailing Cloudflare Tunnel routes same-origin `mitsailing.com` paths to
  app, upload, and media services.
- Media-serving and upload-service downtime is acceptable only for explicit
  night maintenance.
- WordPress remains separate and untouched at `wp.mitsailing.com`.
