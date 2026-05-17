# Superpowers Docs

These are historical planning artifacts, not active production runbooks.

For current production deployment, Cloudflare Tunnel, media, and zero-downtime
operations, use:

- [`../deploy.md`](../deploy.md)
- [`../devops_plan.md`](../devops_plan.md)

Current production shape:

- one Docker Compose stack on `ak@sailing-dock.mit.edu`;
- Docker named volumes for Postgres, Redis, and CMS media;
- same-origin Cloudflare Tunnel routes on `mitsailing.com`;
- no separate upload or media subdomains;
- no host nginx, host cloudflared, or `/srv` bind mounts;
- WordPress remains separate at `wp.mitsailing.com`.
