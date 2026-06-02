# syntax=docker/dockerfile:1.9
#
# Multi-stage build with three "leaf" targets so one Dockerfile serves the
# local-dev, CI-test, and production stacks:
#
#   deps    → just a warm node_modules cache, shared by every other stage
#   builder → `next build` → emits .next/standalone/ (next.config:output)
#   dev     → docker-compose `target: dev` — hot-reload via `next dev`,
#             assumes the workspace is bind-mounted over /app
#   prod    → docker-compose `target: prod` — slim runtime (only server.js
#             + the copied node_modules), non-root user, `node server.js`
#
# The split matters because prod would otherwise ship devDependencies,
# full source, and tests — roughly tripling image size and widening the
# supply-chain surface. `output: 'standalone'` in next.config gives us
# exactly what we need to COPY.

ARG NODE_VERSION=24-alpine

# ─────────────────────────────── deps ───────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat keeps the node runtime happy with Prisma's prebuilt binaries
# on alpine; openssl is required at both build and runtime for Prisma.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
# `postinstall` runs this script after `prisma generate`; it must exist here
# even though the deps stage does not COPY the full repo yet.
COPY scripts/playwright-postinstall.cjs ./scripts/playwright-postinstall.cjs
# Skip Playwright browser download in the image (Alpine has no e2e browsers;
# postinstall still runs `prisma generate` for a valid node_modules tree).
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm ci --include=dev --no-audit --no-fund


# ─────────────────────────────── builder ───────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Regenerate the Prisma client against the current schema so the build
# includes its types.
RUN npx prisma generate

ENV NEXT_TELEMETRY_DISABLED=1

# Sentry: defaults keep SDK + webpack plugin off for local/PR builds. Production
# CI passes empty `NEXT_PUBLIC_SENTRY_DISABLED`, `NEXT_PUBLIC_SENTRY_DSN`, and
# `SENTRY_AUTH_TOKEN` (builder only — not copied to the `prod` stage).
ARG NEXT_PUBLIC_SENTRY_DISABLED=1
ENV NEXT_PUBLIC_SENTRY_DISABLED=${NEXT_PUBLIC_SENTRY_DISABLED}
ARG NEXT_PUBLIC_SENTRY_DSN=
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ARG SENTRY_AUTH_TOKEN=
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

# `NEXT_PUBLIC_*` is inlined at `next build`. Production CI must pass
# `--build-arg NEXT_PUBLIC_APP_URL=https://your.domain` so the client bundle
# matches the public origin (see deploy.yml). Local / PR builds keep default.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
# Optional release id for Next `deploymentId` + Sentry releases (short SHA is typical).
ARG DEPLOYMENT_VERSION=
ENV DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION}
# Same story: BETTER_AUTH_SECRET is validated (min 32 chars) at import
# time by t3-env. The real secret is injected at runtime.
ENV BETTER_AUTH_SECRET=build-time-placeholder-that-is-at-least-thirty-two-chars-long
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?sslmode=disable
# Turbopack + route type generation can exceed Node's default Docker heap on
# local Docker Desktop builders. Builder stage only; not copied to prod runtime.
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build:next
RUN npm run build:worker


# ─────────────────────────────── dev ───────────────────────────────
# Intended for compose.override.yaml where the workspace is bind-mounted
# onto /app — we keep node_modules from `deps` as a baseline but the app
# code comes from the bind mount so edits hot-reload.
FROM node:${NODE_VERSION} AS dev
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3000
CMD ["npm", "run", "dev:next"]


# ─────────────────────────────── prod ───────────────────────────────
FROM node:${NODE_VERSION} AS prod
WORKDIR /app

# Same ARG as `builder` so `docker build --build-arg NEXT_PUBLIC_APP_URL=…`
# applies here too. `ENV` bakes the value into the runtime image (Compose can
# still override). Without this, bare `docker run` smoke tests would need `-e`.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN apk add --no-cache libc6-compat openssl

# Non-root runtime — container breakouts that land on PID 1 only get a
# restricted shell.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
# Runtime CMS media uploads live here; production must mount it as a volume.
RUN mkdir -p /var/lib/mitsailing/cms-media \
  && chown nextjs:nodejs /var/lib/mitsailing/cms-media

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Standalone output bundles only the server files plus a pruned
# node_modules tree; we copy public/ and .next/static separately because
# `output: 'standalone'` leaves those outside the bundle intentionally.
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Ship full node_modules from the builder so Prisma CLI can resolve all
# transitive dependencies during `prisma migrate deploy` in production.
# Prisma 7 pulls runtime modules (for example `effect`) that are not present
# when only copying `@prisma` and `prisma` directories.
COPY --from=builder --chmod=0555 /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
# Production operations run `npm run db:seed` from this image after fresh DB
# creation; ship the seed-only modules that Next standalone tracing omits.
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/lib/mit-sailing/nyTime.ts ./src/lib/mit-sailing/nyTime.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/data ./src/data
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/generated ./src/generated
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/DB.ts ./src/libs/DB.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/Env.ts ./src/libs/Env.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/auth/passwordHashing.ts ./src/libs/auth/passwordHashing.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/auth/roles.ts ./src/libs/auth/roles.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/legacy-sync/legacyMysqlSyncConstants.ts ./src/libs/legacy-sync/legacyMysqlSyncConstants.ts
COPY --from=builder --chown=nextjs:nodejs --chmod=0444 /app/src/libs/mit-sailing/pavilionReservationPersonas.ts ./src/libs/mit-sailing/pavilionReservationPersonas.ts
COPY --from=builder --chown=nextjs:nodejs /app/worker.mjs ./worker.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/worker-redis-healthcheck.cjs ./worker-redis-healthcheck.cjs

USER nextjs
EXPOSE 3000

# HEALTHCHECK uses the Next.js response rather than exec'ing curl so we
# don't have to install another package. `/api/health/live` proves the
# standalone server can execute a Node route handler without coupling
# container liveness to page rendering or dependency state.
# The BullMQ worker (`worker.mjs`) reuses this image but does not serve HTTP;
# compose.prod.yaml overrides healthcheck for the `worker` service (Redis reachability via REDIS_URL).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
