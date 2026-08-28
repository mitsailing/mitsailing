/**
 * Starts the production standalone server and BullMQ worker for Playwright.
 *
 * The standalone server is required for every e2e navigation. The worker is
 * best-effort: if it exits early, keep the server up so page tests can still
 * run and surface a clear connection instead of a mass ERR_CONNECTION_REFUSED
 * after Playwright already marked the webServer ready.
 */
const { spawn } = require('node:child_process');

let shuttingDown = false;

/**
 * @param {import('node:child_process').ChildProcess | undefined} child - Child to signal.
 * @param {NodeJS.Signals} signal - Signal to send.
 */
function signalChild(child, signal) {
  if (!child) {
    return;
  }
  if (child.exitCode === null && child.signalCode === null) {
    child.kill(signal);
  }
}

/**
 * @param {number} exitCode - Exit code for this wrapper process.
 */
function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  signalChild(serverChild, 'SIGTERM');
  signalChild(workerChild, 'SIGTERM');
  setTimeout(() => {
    signalChild(serverChild, 'SIGKILL');
    signalChild(workerChild, 'SIGKILL');
    process.exit(exitCode);
  }, 5000);
}

/**
 * @param {string} name - Process label for logs.
 * @param {readonly string[]} args - `node` arguments.
 * @param {{ fatal: boolean }} options - Whether an early exit should stop e2e.
 * @returns {import('node:child_process').ChildProcess} Spawned Node process.
 */
function startNodeProcess(name, args, options) {
  const child = spawn('node', [...args], {
    env: process.env,
    stdio: 'inherit',
  });
  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[e2e-start] ${name} failed to start (${error.message}).`);
    if (options.fatal) {
      shutdown(1);
    }
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const status = typeof code === 'number' ? code : 1;
    console.error(`[e2e-start] ${name} exited early (${signal ?? status}).`);
    if (options.fatal) {
      shutdown(status);
    }
  });
  return child;
}

const serverChild = startNodeProcess(
  'standalone server',
  ['.next/standalone/server.js'],
  { fatal: true }
);
const workerChild = startNodeProcess('worker', ['worker.mjs'], {
  fatal: false,
});

process.on('SIGINT', () => {
  shutdown(0);
});
process.on('SIGTERM', () => {
  shutdown(0);
});
