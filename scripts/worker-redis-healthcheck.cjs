/**
 * TCP reachability check for Redis using `REDIS_URL` (host + port only).
 * Used by `compose.prod.yaml` for the BullMQ worker; the app image has no HTTP on :3000.
 */
const net = require('node:net');

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

const host = u.hostname;
const port = u.port ? Number(u.port) : 6379;
if (!host) {
  process.stderr.write('worker-redis-healthcheck: missing host in REDIS_URL\n');
  process.exit(1);
}

const deadlineMs = 4500;
const timer = setTimeout(() => {
  process.stderr.write('worker-redis-healthcheck: connect timeout\n');
  process.exit(1);
}, deadlineMs);

const socket = net.connect({ host, port }, () => {
  clearTimeout(timer);
  socket.end();
  process.exit(0);
});

socket.on('error', (err) => {
  clearTimeout(timer);
  process.stderr.write(`worker-redis-healthcheck: ${err.message}\n`);
  process.exit(1);
});
