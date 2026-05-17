#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const DEFAULT_SSH_TARGET = 'sailing-dock.mit.edu';
const DEFAULT_REMOTE_DIR = 'apps/mitsailing';
const DEFAULT_LOCAL_ROOT = 'local/cms-media';
const REMOTE_MEDIA_ROOT = '/var/lib/mitsailing/cms-media';

/**
 * @typedef {object} SyncOptions
 * @property {string} localRoot Local CMS media root.
 * @property {string} remoteDir Remote app directory.
 * @property {boolean} showHelp Whether to print help and exit.
 * @property {string} sshTarget SSH target for the production host.
 */

/**
 * @returns {string} CLI help text.
 */
function usage() {
  return `Usage: node scripts/sync-prod-media.mjs [options]

Downloads production CMS ready media into the local gitignored media tree.

Options:
  --ssh-target <target>  SSH target for the production host.
                         Default: ${DEFAULT_SSH_TARGET}
  --remote-dir <path>    App directory on the production host.
                         Default: ${DEFAULT_REMOTE_DIR}
  --local-root <path>    Local CMS media root. The script extracts ready/ here.
                         Default: ${DEFAULT_LOCAL_ROOT}
  --help                 Show this help text.
`;
}

/**
 * @param {string[]} args CLI arguments.
 * @param {number} index Current flag index.
 * @param {string} flag Flag that requires a value.
 * @returns {string} Parsed flag value.
 */
function parseArgValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

/**
 * @param {string[]} args CLI arguments.
 * @returns {SyncOptions} Parsed sync options.
 */
function parseArgs(args) {
  /** @type {SyncOptions} */
  const options = {
    localRoot: DEFAULT_LOCAL_ROOT,
    remoteDir: DEFAULT_REMOTE_DIR,
    showHelp: false,
    sshTarget: DEFAULT_SSH_TARGET,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
    } else if (arg === '--ssh-target') {
      options.sshTarget = parseArgValue(args, index, arg);
      index += 1;
    } else if (arg.startsWith('--ssh-target=')) {
      options.sshTarget = arg.slice('--ssh-target='.length);
    } else if (arg === '--remote-dir') {
      options.remoteDir = parseArgValue(args, index, arg);
      index += 1;
    } else if (arg.startsWith('--remote-dir=')) {
      options.remoteDir = arg.slice('--remote-dir='.length);
    } else if (arg === '--local-root') {
      options.localRoot = parseArgValue(args, index, arg);
      index += 1;
    } else if (arg.startsWith('--local-root=')) {
      options.localRoot = arg.slice('--local-root='.length);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

/**
 * @param {string} value Shell token to quote.
 * @returns {string} Single-quoted shell token.
 */
function shellQuote(value) {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

/**
 * @param {string} remoteDir Remote app directory.
 * @returns {string} Remote tar command.
 */
function remoteTarCommand(remoteDir) {
  return [
    `cd ${shellQuote(remoteDir)}`,
    'docker compose -f compose.yaml -f compose.prod.yaml --profile release --env-file .env.production --env-file .env.image exec -T media tar -C ' +
      `${shellQuote(REMOTE_MEDIA_ROOT)} -cf - ready`,
  ].join(' && ');
}

/**
 * @param {SyncOptions} options Parsed sync options.
 */
function syncReadyMedia(options) {
  const localRoot = path.resolve(options.localRoot);
  mkdirSync(localRoot, { recursive: true });
  const command = [
    'ssh',
    shellQuote(options.sshTarget),
    shellQuote(remoteTarCommand(options.remoteDir)),
    '|',
    'tar',
    '-xpf',
    '-',
    '-C',
    shellQuote(localRoot),
  ].join(' ');
  const result = spawnSync('sh', ['-c', command], { stdio: 'inherit' });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`media sync failed with exit code ${result.status}`);
  }
  process.stdout.write(`Synced production ready media into ${localRoot}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.showHelp) {
    process.stdout.write(usage());
    return;
  }
  syncReadyMedia(options);
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
