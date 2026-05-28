import { config as loadEnv } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma loads this module before `dotenv-cli` is guaranteed to apply; match
// `scripts/migrate-test-db.mjs` and fall back to `.env.example` so `npm run dev`
// works right after clone until you run `cp .env.example .env` (still required
// for BETTER_AUTH_SECRET and real OAuth).
loadEnv({ path: '.env.local', override: false });
loadEnv({ path: '.env', override: false });
if (!process.env.DATABASE_URL) {
  loadEnv({ path: '.env.example', override: false });
}

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create .env from the template: cp .env.example .env'
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
