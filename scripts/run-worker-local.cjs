#!/usr/bin/env node
/**
 * Runs the bundled BullMQ worker for local Next.js 16 Node development.
 * Defaults REDIS_URL to the docker-compose Redis when unset.
 */
const { spawn } = require('node:child_process');
const path = require('node:path');

const redisUrl = process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
const workerPath = path.join(__dirname, '..', 'worker.mjs');

const child = spawn(process.execPath, [workerPath], {
  env: { ...process.env, REDIS_URL: redisUrl },
  stdio: 'inherit',
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
