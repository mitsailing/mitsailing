# MIT Sailing

The public site and internal app for the [MIT Sailing Pavilion](https://mitsailing.com) — pavilion and programs on the Charles.

- **Production:** <https://mitsailing.com>
- **Repo:** <https://github.com/mitsailing/mitsailing>
- **CMS architecture reference:** <https://github.com/docmost/docmost> (page history and attachment/media patterns; MIT Sailing implementation is written in this repo rather than vendoring Docmost source)

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, next-intl, Prisma + PostgreSQL, and Better Auth. End-to-end tests with Playwright, unit tests with Vitest, and synthetic monitoring with Checkly.

### Self-hosting and local development (Next.js)

This repo follows current Next.js guidance: **production** ships as **`output: 'standalone'`** and runs with **`next build`** / **`next start`** (or the production Docker stage). For **development**, Next.js recommends running **`next dev` on the host** for better performance on macOS and Windows, and using Docker where it helps for dependencies—here, **Postgres + Mailpit in Compose**, not the Next.js process. See the Next.js docs on [deploying](https://nextjs.org/docs/app/building-your-application/deploying) (Node server + Docker), [self-hosting](https://nextjs.org/docs/app/guides/self-hosting) (proxies, env, caching in production), and [local development](https://nextjs.org/docs/app/guides/local-development).

---

## Getting started

### First time on this repo (checklist)

Do these **in order** the first time you open the project (or on a new laptop).

| Step | What to do |
| ---- | ---------- |
| 1 | Install **Node.js ≥ 24**, **npm**, and **Docker Desktop** (start Docker and wait until it says it is running). |
| 2 | Clone the repo and `cd` into it — see [Clone and install](#clone-and-install). |
| 3 | **`cp .env.example .env`** — you need a real **`.env`** file (it is not committed to git). |
| 4 | Open **`.env`**: set **`BETTER_AUTH_SECRET`** to a random string **at least 32 characters** (see comments in the template; e.g. `openssl rand -base64 32`). **Change `ADMIN_EMAIL` and `ADMIN_PASSWORD` away from the template defaults** before you run seed (step 7) if anyone else can reach your dev server, you’re on a shared network, or you just don’t want a well-known admin login—those defaults are only for quick **solo** local use. |
| 5 | **`npm install`** — **`postinstall`** runs Prisma client generation and **`npx playwright install chromium`** for local e2e ([Next.js + Playwright](https://nextjs.org/docs/app/building-your-application/testing/playwright)); skipped in GitHub Actions and in the Docker **deps** stage. |
| 6 | From the **project root** (folder that contains `compose.yaml`), run **`npm run dev`**. First run starts **Postgres + Mailpit in Docker**, runs migrations, then starts the site on **<http://localhost:3000>**. |
| 7 | **First run only — sample data + admin user:** open a **second terminal**, same folder, with **`npm run dev` still running**, and run **`npm run db:seed`**. That loads demo content and creates an admin you can log in with. |
| 8 | **Log in:** open **<http://localhost:3000/login>** using **`ADMIN_EMAIL`** and **`ADMIN_PASSWORD`** exactly as they appear in **your** **`.env`** (whatever you set in step 4). |

After step 8 you are done with first-time setup. Next time: **Docker on** → **`npm run dev`** from the project root. Run **`npm run db:seed`** again only if you reset the database or need to refresh seed data.

**If `npm run dev` fails** with “port already allocated”, see [Troubleshooting: port already allocated](#troubleshooting-port-already-allocated) below.

### Requirements

- Node.js **≥ 24** and npm
- **Docker Desktop** (or another Docker engine with Compose v2) — must be running before you start dev. Only **Postgres** and **Mailpit** run in containers; the Next.js app runs on the host.

### Clone and install

```shell
git clone https://github.com/mitsailing/mitsailing.git
cd mitsailing
cp .env.example .env
# Edit `.env`: BETTER_AUTH_SECRET (required), ADMIN_EMAIL / ADMIN_PASSWORD (change defaults if needed), OAuth keys when you add social login.
npm install
```

> We clone into a folder named **`mitsailing`** on purpose: it matches the package name, the repo slug, and the public domain. Scripts and docs assume that path.

### How local dev is wired (why not “everything in Docker”?)

This matches **2026 Next.js** practice: **`next dev` runs on your computer** (fast refresh, easy debugging). **Docker** only runs **Postgres** and **Mailpit**. The app is **not** in a container for normal `npm run dev`.

| What | Where it runs |
| ---- | ------------- |
| **Next.js** (`next dev`, Spotlight) | **Your machine** — port **3000** |
| **Postgres** | **Docker** — localhost (default **5432**) |
| **Mailpit** (captured email) | **Docker** — **1025** (SMTP), **8025** (inbox UI) |

**`npm run db:down` then `npm run dev`** only restarts the **database/mail** containers, then starts **`next dev` again on the host**. Use that when you changed ports in **`.env`** or need a clean slate—not every day.

**Typical day:** Docker running → **`npm run dev`** from the repo root (that runs **`db:up`** → **`db:wait`** → **`db:migrate`** → **`next dev`**). You do **not** need **`db:down`** before each session.

**Production** uses **`next build`** / **`next start`** or the **Docker** image — see [`docs/deploy.md`](docs/deploy.md).

**Docker Compose (local) — conventions**

| Practice | Why |
| -------- | --- |
| Run Compose **from the repo root** | Compose loads `compose.yaml` + `compose.override.yaml` from the current directory; other cwd → wrong or missing project. |
| **`npm run db:up`** uses `docker compose up -d postgres mailpit` | **Explicit service names** document the “local infra” slice and avoid starting extra services if more are added to this project later. Today only those two services exist, so **`docker compose up -d`** (no names) is equivalent. Compose maps Postgres to **`${POSTGRES_PUBLISH_PORT:-5432}`** on the host (set in `.env`; default `5432`). |
| Prefer **`npm run db:up`** / **`npm run db:down`** | Same as raw Compose; these are the canonical scripts used by **`npm run dev`**, **`npm run test:e2e`** (via `e2e:preflight`), and **`scripts/build-local.mjs`**. |

**Stop infra:**

```shell
npm run db:down
```

**Optional — infra only, then app** (repo root; e.g. when iterating on migrations):

```shell
docker compose up -d postgres mailpit
# equivalent: npm run db:up
npm run db:wait
npm run db:migrate
npm run dev:app
```

> If something else already uses **5432**, **1025**, or **8025**, see [Troubleshooting: port already allocated](#troubleshooting-port-already-allocated).

### Troubleshooting: port already allocated

Docker prints **`Bind for 0.0.0.0:… failed: port is already allocated`** when the **host** port is already taken.

**Postgres (default 5432)** — another Postgres or container is using it. Either stop that service, or in **`.env`** set **`POSTGRES_PUBLISH_PORT`** (e.g. `5433`) and the same port inside **`DATABASE_URL`** / **`TEST_DATABASE_URL`**, then **`npm run db:down`** and **`npm run dev`** again.

**Mailpit SMTP (1025) or UI (8025)** — same idea: set **`MAILPIT_SMTP_PUBLISH_PORT`** / **`MAILPIT_HTTP_PUBLISH_PORT`** in **`.env`** and matching **`SMTP_URL`** / **`MAILPIT_API_URL`**, then **`npm run db:down`** and **`npm run dev`** again.

---

## Git remote

This repo uses `origin` as the canonical MIT Sailing remote:

| Remote   | URL                                        | What it's for                               |
| -------- | ------------------------------------------ | ------------------------------------------- |
| `origin` | `https://github.com/mitsailing/mitsailing` | Day-to-day `push` / `pull` target.          |

Verify your local remotes:

```shell
git remote -v
```

You should see `origin` pointing at `mitsailing/mitsailing`.

### If you cloned **before** the repo moved

If your `origin` does not point at MIT Sailing, re-point it once:

```shell
git remote set-url origin https://github.com/mitsailing/mitsailing.git
git fetch origin
git branch --set-upstream-to=origin/main main
```

---

## Scripts

```shell
npm run dev              # db:up → db:wait → db:migrate → next dev (+ Spotlight)
npm run db:wait          # wait for Postgres on POSTGRES_PUBLISH_PORT (default 5432)
npm run db:up            # docker compose up -d postgres mailpit
npm run db:down          # docker compose down
npm run db:test:up       # explicit test DB lifecycle start (alias of db:up)
npm run db:test:down     # explicit test DB lifecycle teardown (alias of db:down)
npm run build            # production build
npm run start            # run the production build
npm run lint             # ultracite / oxlint type-aware check
npm run lint:fix         # auto-fix
npm run check:types      # tsc --noEmit
npm run check:deps       # knip unused-code report
npm run check:i18n       # next-intl message coverage
npm run test             # Vitest unit + browser tests
npm run test:coverage    # Vitest V8 coverage + script-enforced 95% branches/statements/lines/functions gate for auth-owned and critical files (scripts/check-critical-coverage.mjs; CI.yml)
npm run test:integration # db:test:up → db:wait → reset + migrate test_db → test → db:test:down
npm run test:e2e         # Playwright end-to-end (spins up a test DB)
npm run storybook        # Storybook dev server on :6006
npm run build-storybook  # static Storybook build
npm run email:dev        # live-reload preview of transactional emails
npm run db:migrate:dev   # prisma migrate dev (apply + generate client)
npm run db:seed          # prisma db seed (fixtures + optional admin; see Database)
npm run db:studio        # prisma studio
```

---

## Database

The project uses Prisma (`@prisma/client` + `@prisma/adapter-pg`) against PostgreSQL. Local development and E2E tests run against Docker Compose; production points at a managed Postgres (e.g. Neon).

### Local development (Docker for infra, host for the app)

`compose.yaml` (shared base) plus `compose.override.yaml` (auto-loaded when you run Compose from the repo root) define two services:

- **`postgres`** — published to **`127.0.0.1:${POSTGRES_PUBLISH_PORT:-5432}`** (see `.env.example`), databases `dev_db` and `test_db` (`test_db` comes from `docker/postgres/init.sql` on first boot).
- **`mailpit`** — SMTP `1025`, web UI + API `8025` (Playwright e2e helpers use the API).

The Next.js app runs on the **host**, not in Compose; Compose is only Postgres + Mailpit. New-developer flow (including **seed** and **login**) is the [First time on this repo](#first-time-on-this-repo-checklist) checklist above.

`npm run test:e2e` uses the same Docker stack and resets + migrates `test_db` via `db:migrate:test`, so stale schemas from other branches are not reused.
Playwright defaults to four workers so the production standalone server, Postgres, Mailpit, and Argon2 auth flows stay deterministic; set `PLAYWRIGHT_WORKERS` to tune for a larger runner.

### Seed data and admin user

**On first setup**, follow [steps 4 and 7 in Getting started](#first-time-on-this-repo-checklist): set **`ADMIN_*`** in **`.env`** how you want (do not rely on well-known defaults if others can reach your dev app), then with **`npm run dev` running** run **`npm run db:seed`** once. That loads **MIT Sailing fixture data** and creates/updates the **credential** admin from those variables.

```shell
npm run db:seed
```

Run **`db:seed`** again after resetting the DB or after you change **`ADMIN_EMAIL`** / **`ADMIN_PASSWORD`** so the DB matches **`.env`**.

### Schema changes

```shell
npm run db:migrate:dev   # create + apply a new migration, regenerate client
```

---

## Authentication

This app uses **[Better Auth](https://www.better-auth.com/)** (self-hosted) with the Prisma adapter. It is **not** Clerk — any leftover Clerk references in older docs or branches are out of date.

Configuration lives in `src/libs/auth/` and environment variables in `src/libs/Env.ts`. See **`.env.example`** for OAuth, SMTP, and other keys. **Local sign-in:** set **`ADMIN_EMAIL`** / **`ADMIN_PASSWORD`** in **`.env`** (see [Getting started step 4](#first-time-on-this-repo-checklist)), run **`npm run db:seed`**, then open **`/login`** with those same values.

---

## Deployment

See [`docs/deploy.md`](docs/deploy.md) for production deploy steps and environment configuration. The canonical production URL is **https://mitsailing.com**.

---

## Contributing

1. Create a feature branch from `main`.
2. Run `npm run lint:fix && npm run check:types && npm run test` before opening a PR.
3. Use [Conventional Commits](https://www.conventionalcommits.org/) for every commit message — this repo runs semantic-release on `main` and the release notes are derived directly from the commit history.

### Commit types

Quick reference for the types we accept; see the [Conventional Commits spec](https://www.conventionalcommits.org/) for full rules (scopes, `BREAKING CHANGE:` footers, etc.).

| Type       | Description                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New feature or functionality                   |
| `fix`      | Bug fix                                        |
| `docs`     | Documentation only                             |
| `style`    | Code formatting without logic changes          |
| `refactor` | Code restructuring without behavior changes    |
| `perf`     | Performance improvement                        |
| `test`     | Adding or updating tests                       |
| `build`    | Build system                                   |
| `ci`       | CI configuration and scripts                   |
| `chore`    | Maintenance tasks (dependencies, config)       |
| `revert`   | Reverts a previous commit                      |

Format: `<type>(<optional scope>): <short imperative summary>` — for example, `feat(fleet): add 420 boat detail page` or `fix(auth): redirect unauthenticated users to /login`.
