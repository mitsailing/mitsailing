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

ARG NODE_VERSION=22.13-alpine

# ─────────────────────────────── deps ───────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat keeps the node runtime happy with Prisma's prebuilt binaries
# on alpine; openssl is required at both build and runtime for Prisma.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
# Disable lifecycle scripts during install; the prisma generate in
# `postinstall` needs the schema (already copied above) and the generated
# client is regenerated in the builder stage anyway.
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
# Sentry source-map upload is a CI concern; always disable during image
# build so the Dockerfile is cacheable and usable offline.
ENV NEXT_PUBLIC_SENTRY_DISABLED=1

# Placeholder NEXT_PUBLIC_APP_URL — Next bakes client env values at build
# time. The runtime container overrides it via env_file, but Env.ts has
# `.min(1)` on it so the build would fail without *some* value.
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000
# Same story: BETTER_AUTH_SECRET is validated (min 32 chars) at import
# time by t3-env. The real secret is injected at runtime.
ENV BETTER_AUTH_SECRET=build-time-placeholder-that-is-at-least-thirty-two-chars-long
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build?sslmode=disable

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

RUN apk add --no-cache libc6-compat openssl

# Non-root runtime — container breakouts that land on PID 1 only get a
# restricted shell.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

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

# Ship the prisma client + migrations so `prisma migrate deploy` can run
# at container startup without pulling the whole workspace.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/worker.cjs ./worker.cjs

USER nextjs
EXPOSE 3000

# HEALTHCHECK uses the Next.js response rather than exec'ing curl so we
# don't have to install another package. Any 2xx/3xx on `/` counts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
