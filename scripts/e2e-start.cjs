/**
 * Starts the production standalone server and BullMQ worker for Playwright.
 */
const { spawn } = require('node:child_process');

/** @type {import('node:child_process').ChildProcess[]} */
const children = [];
let shuttingDown = false;

/**
 * @param {string} name - Process label for logs.
 * @param {string} command - Executable name.
 * @param {readonly string[]} args - Executable arguments.
 */
function startProcess(name, command, args) {
  const child = spawn(command, [...args], {
    env: process.env,
    stdio: 'inherit',
  });
  children.push(child);
  child.on('error', (error) => {
    if (shuttingDown) {
      return;
    }
    console.error(`[e2e-start] ${name} failed to start (${error.message}).`);
    shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }
    const status = typeof code === 'number' ? code : 1;
    console.error(`[e2e-start] ${name} exited early (${signal ?? status}).`);
    shutdown(status);
  });
}

/**
 * @param {number} exitCode - Exit code for this wrapper process.
 */
function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
  }
  setTimeout(() => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL');
      }
    }
    process.exit(exitCode);
  }, 5000);
}

process.on('SIGINT', () => {
  shutdown(0);
});
process.on('SIGTERM', () => {
  shutdown(0);
});

startProcess('worker', 'node', ['worker.mjs']);
startProcess('standalone server', 'node', ['.next/standalone/server.js']);
