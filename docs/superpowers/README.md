# Superpowers Docs

These are historical planning artifacts, not active production runbooks.

For current production deployment, Cloudflare Tunnel, media, and zero-downtime
operations, use:

- [`../deploy.md`](../deploy.md)
- [`../devops_plan.md`](../devops_plan.md)

Current production shape:

- one Docker Compose stack on `deploy@example.com`;
- host bind mounts under `/srv/mitsailing-data` for Postgres, Redis, and CMS media;
- same-origin Cloudflare Tunnel routes on `mitsailing.com`;
- no separate upload or media subdomains;
- no host nginx or host cloudflared;
- WordPress remains separate at `wp.mitsailing.com`.
