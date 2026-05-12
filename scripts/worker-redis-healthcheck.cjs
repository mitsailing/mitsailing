/**
 * Redis PING check using `REDIS_URL`.
 * Used by `compose.prod.yaml` for the BullMQ worker; the app image has no HTTP on :3000.
 */
const IORedis = require('ioredis');

const redisUrlRaw = process.env.REDIS_URL;
if (typeof redisUrlRaw !== 'string' || redisUrlRaw.length === 0) {
  process.stderr.write('worker-redis-healthcheck: REDIS_URL is not set\n');
  process.exit(1);
}

let u;
try {
  u = new URL(redisUrlRaw);
} catch {
  process.stderr.write(
    'worker-redis-healthcheck: REDIS_URL is not a valid URL\n'
  );
  process.exit(1);
}

if (!u.hostname) {
  process.stderr.write('worker-redis-healthcheck: missing host in REDIS_URL\n');
  process.exit(1);
}

async function main() {
  const client = new IORedis(redisUrlRaw, {
    connectTimeout: 4500,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });

  try {
    await client.connect();
    await client.ping();
    process.exit(0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`worker-redis-healthcheck: ${message}\n`);
    process.exit(1);
  } finally {
    client.disconnect();
  }
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises -- main catches failures and exits with the health status.
main();
