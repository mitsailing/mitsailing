# MIT Sailing

[![CI](https://github.com/mitsailing/mitsailing/actions/workflows/CI.yml/badge.svg)](https://github.com/mitsailing/mitsailing/actions/workflows/CI.yml)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/e097a13cd5b542fc8157660ba3224a06)](https://app.codacy.com/gh/mitsailing/mitsailing/dashboard?utm_source=gh&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=mitsailing&metric=sqale_rating)](https://sonarcloud.io/summary/overall?id=mitsailing)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=mitsailing&metric=duplicated_lines_density)](https://sonarcloud.io/summary/overall?id=mitsailing)

<!-- Public badges intentionally exclude security ratings, vulnerability counts, security hotspot counts, and bug counts. -->

The public site and internal operations app for the [MIT Sailing Pavilion](https://mitsailing.com): content, programs, events, reservations, admin workflows, CMS media, email, and production monitoring.

Built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, next-intl, Prisma/PostgreSQL, Redis/BullMQ, Better Auth, Vitest, Playwright, Checkly, and Docker Compose.

## Quick Start

Requirements: Node.js 24+, npm, Docker with Compose v2, and repo access.

```shell
git clone https://github.com/mitsailing/mitsailing.git
cd mitsailing
cp .env.example .env
npm install
```

Edit `.env` before first run:

- set `BETTER_AUTH_SECRET` to a random 32+ character value;
- set `ADMIN_EMAIL` and `ADMIN_PASSWORD` for your local admin login;
- keep `DATABASE_URL` pointed at local `dev_db`.

Start local services and the app:

```shell
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000). Local Docker runs Postgres, Redis, Mailpit, tusd, and media nginx; Next.js runs on the host for normal development. See [docs/local-development.md](docs/local-development.md) for the full local runtime, worker, cron, upload, and media sync workflow.

For a blank local database, seed it once while `npm run dev` is running:

```shell
npm run db:seed
```

Log in at `/login` with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` values from `.env`.

## Production Data Locally

Prefer developing against a fresh copy of production data when working on admin, CMS, reporting, auth, reservation, newsletter, or migration behavior.

Use the repo pgsync workflow:

1. Install [`pgsync`](https://github.com/ankane/pgsync), for example `brew install pgsync`.
2. Ensure `.env` has local `DATABASE_URL` pointing at `127.0.0.1` or `localhost` / `dev_db`.
3. Set `PGSYNC_FROM_URL` in `.env` to the SSH-tunneled production database URL described in [.cursor/skills/pgsync-prod-to-local/SKILL.md](.cursor/skills/pgsync-prod-to-local/SKILL.md); it should point at local tunnel port `127.0.0.1:15432`.
4. Follow that skill exactly: open the temporary loopback container on `example.com`, open the SSH tunnel, run `pgsync --defer-constraints --truncate --jobs 1`, then clean up the tunnel and loopback container.

`pgsync` copies data only and truncates/replaces local data. Run local migrations first so `dev_db` already has the expected schema.

To make synced CMS pages render production media locally, download public ready media files over SSH:

```shell
export PRODUCTION_SSH_TARGET=username@example.com
node scripts/sync-prod-media.mjs
```

Replace `username@example.com` with your SSH login for the production host
before running the command.

The media sync copies only production `/srv/mitsailing-data/cms-media/ready` into `local/cms-media/ready`; it does not copy raw in-progress uploads.

## Checks

Core local checks:

```shell
npm run lint
npm run check:types
npm run check:deps
npm run check:i18n
npm run test
npm run test:coverage
npm run test:e2e
```

`npm run build-local` is the local production-build gate used by CI.

## Product Domain Docs

- [docs/mit-sailing/sailing-card-memberships.md](docs/mit-sailing/sailing-card-memberships.md) - sailing-card membership labels, pricing rules, and legacy WordPress terminology.

## CI And Deployment

Pull requests run build/static checks, unit coverage, integration tests, Storybook checks, sharded Playwright e2e, Docker smoke/security checks, CodeQL, coverage upload, and optional previews. `main` runs semantic-release and the production deploy workflow.

Production deploys are normally automatic after merge to `main`: GitHub Actions builds and attests a GHCR image, syncs deploy files to `PRODUCTION_SSH_TARGET`, then runs `bin/deploy.sh release <image-tag>`. The deploy job may wait for GitHub `production` environment approval when required reviewers are configured.

Example placeholders in docs and tests:

- `username@example.com` means your SSH login for pulling production data or media to your local computer. In app data examples, it is also the simple fake user email.
- `username` means a simple fake app user ID.
- `deploy@example.com` means the GitHub CI deploy SSH target: user `deploy` on host `example.com`.

Manual work is needed when:

- production environment secrets or variables change;
- Cloudflare Tunnel hostname/path routing changes;
- Docker/rootless host prerequisites change, including linger or
  `/srv/mitsailing-data` ownership and ACLs;
- backup/restore procedures need rehearsal;
- a release with database migrations needs a rollback decision;
- media or upload services need maintenance. App deploys do not restart `tusd` or media nginx, so use the explicit night-maintenance policy in [docs/media-maintenance.md](docs/media-maintenance.md).

Production architecture and operations:

- [docs/deploy.md](docs/deploy.md) — deploy, rollback, Cloudflare, media maintenance, verification, backups.
- [docs/devops_plan.md](docs/devops_plan.md) — concise production architecture and no-sudo boundary.
- [docs/local-development.md](docs/local-development.md) — local Docker services, worker/cron behavior, uploads, and production media sync.
- [docs/media-maintenance.md](docs/media-maintenance.md) — planned media nginx and tusd maintenance policy.
- [AGENTS.md](AGENTS.md) — contributor and agent rules for TypeScript, tests, i18n, React, Next.js, Sonar, and CI expectations.

WordPress at `wp.mitsailing.com` is a separate stack and tunnel. Do not connect this app to the WordPress compose network or tunnel.

## Common Commands

```shell
npm run dev            # local infra + migrations + Next dev server
npm run db:seed        # local fixture data and admin user
npm run worker:dev     # local BullMQ worker when needed
PRODUCTION_SSH_TARGET=username@example.com node scripts/sync-prod-media.mjs
npm run test:e2e       # Playwright end-to-end gate
```

For schema changes use Prisma migrations; for production deploy and rollback commands, use [docs/deploy.md](docs/deploy.md).
