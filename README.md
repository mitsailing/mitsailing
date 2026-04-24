# MIT Sailing

The public site and internal app for the [MIT Sailing Pavilion](https://mitsailing.com) — pavilion and programs on the Charles.

- **Production:** <https://mitsailing.com>
- **Repo:** <https://github.com/mitsailing/mitsailing>
- **Upstream boilerplate:** <https://github.com/ixartz/Next-js-Boilerplate> (this codebase began as a fork; see [Git remotes](#git-remotes) below)

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, next-intl, Prisma + PostgreSQL, and Better Auth. End-to-end tests with Playwright, unit tests with Vitest, and synthetic monitoring with Checkly.

---

## Getting started

### Requirements

- Node.js **≥ 22** and npm
- Docker Desktop (or equivalent) — only for the Postgres + Mailpit containers; the Next.js app runs natively on the host

### Clone and install

```shell
git clone https://github.com/mitsailing/mitsailing.git
cd mitsailing
npm install
```

> We clone into a folder named **`mitsailing`** on purpose: it matches the package name, the repo slug, and the public domain. Scripts and docs assume that path.

### Run locally

```shell
npm run dev
```

This runs `db:up → db:wait → db:migrate → dev:app` under the hood. Open <http://localhost:3000>.

**How the local stack is split:** the Next.js app runs on your **host** (via `next dev`) while only the **infrastructure** — Postgres and Mailpit — runs in Docker. `npm run dev` brings up the Compose services (`compose.yaml` + `compose.override.yaml`) in the background, waits for Postgres on `127.0.0.1:5432`, applies migrations, and then starts Next. This keeps HMR, source maps, and IDE integration fast and native on the host while still giving you a real Postgres + SMTP server that matches production behavior. Tear the stack down with `npm run db:down` when you're done.

> Make sure nothing else on your machine is already listening on ports `5432` / `1025` / `8025`.

---

## Git remotes

This repo uses the standard two-remote workflow that [GitHub recommends for forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/configuring-a-remote-repository-for-a-fork):

| Remote     | URL                                                   | What it's for                                                            |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------------------------ |
| `origin`   | `https://github.com/mitsailing/mitsailing`            | Our app. Day-to-day `push` / `pull` target.                              |
| `upstream` | `https://github.com/ixartz/Next-js-Boilerplate`       | The original boilerplate. Fetch updates from here, then merge into ours. |

Verify your local remotes:

```shell
git remote -v
```

You should see `origin` pointing at `mitsailing/mitsailing` and `upstream` pointing at `ixartz/Next-js-Boilerplate`.

### Pulling updates from the upstream boilerplate

```shell
git fetch upstream
git merge upstream/main   # or: git rebase upstream/main
git push origin
```

Resolve conflicts as usual. Prefer `merge` for shared branches; `rebase` if you want a linear history on a personal branch.

### If you cloned **before** the repo moved

If your `origin` still points at `ixartz/Next-js-Boilerplate`, re-point it once:

```shell
git remote rename origin upstream
git remote add origin https://github.com/mitsailing/mitsailing.git
git fetch origin
git branch --set-upstream-to=origin/main main
```

---

## Scripts

```shell
npm run dev              # full local stack (Postgres + Mailpit + Next.js)
npm run build            # production build
npm run start            # run the production build
npm run lint             # ultracite / oxlint type-aware check
npm run lint:fix         # auto-fix
npm run check:types      # tsc --noEmit
npm run check:deps       # knip unused-code report
npm run check:i18n       # next-intl message coverage
npm run test             # Vitest unit + browser tests
npm run test:e2e         # Playwright end-to-end (spins up a test DB)
npm run storybook        # Storybook dev server on :6006
npm run build-storybook  # static Storybook build
npm run email:dev        # live-reload preview of transactional emails
npm run db:migrate:dev   # prisma migrate dev (apply + generate client)
npm run db:studio        # prisma studio
```

---

## Database

The project uses Prisma (`@prisma/client` + `@prisma/adapter-pg`) against PostgreSQL. Local development and E2E tests run against Docker Compose; production points at a managed Postgres (e.g. Neon).

### Local development (Docker for infra, host for the app)

`compose.yaml` (shared base) plus `compose.override.yaml` (auto-loaded for local dev) define two services at the repo root:

- `postgres` on port `5432`, with `dev_db` and `test_db` (the latter is created by `docker/postgres/init.sql` on first boot).
- `mailpit` on ports `1025` (SMTP) and `8025` (inbox UI + REST API used by the Playwright e2e helpers).

The Next.js app itself runs on your host, not in a container — this keeps `next dev`'s HMR, source maps, and debugger / IDE integration native. Compose is only in charge of the backing services.

`npm run dev` runs `db:up` → `db:wait` → `db:migrate` → `dev:app` for you. The same pattern drives `npm run test:e2e`, which additionally migrates `test_db` via `db:migrate:test`. Tear the stack down when done:

```shell
npm run db:down
```

### Schema changes

```shell
npm run db:migrate:dev   # create + apply a new migration, regenerate client
```

---

## Authentication

This app uses **[Better Auth](https://www.better-auth.com/)** (self-hosted) with the Prisma adapter. It is **not** Clerk — any leftover Clerk references in older docs or branches are out of date.

Configuration lives in `src/libs/auth/` and environment variables in `src/libs/Env.ts`. See `.env.example` for the full list of required secrets (OAuth client IDs, session secrets, SMTP / Resend credentials, etc.).

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

---

## Credits

This project started as a fork of [ixartz/Next-js-Boilerplate](https://github.com/ixartz/Next-js-Boilerplate) and retains its `LICENSE`. Thanks to the upstream maintainers for the starting point.
