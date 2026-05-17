#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_SSH_TARGET = 'sailing-dock.mit.edu';
const DEFAULT_REMOTE_DIR = 'apps/mitsailing';
const DEFAULT_LOCAL_ROOT = 'local/cms-media';
const REMOTE_MEDIA_ROOT = '/var/lib/mitsailing/cms-media';
const SSH_TARGET_PATTERN =
  /^(?:[A-Za-z0-9._~-]+@)?[A-Za-z0-9._~-]+(?::[0-9]{1,5})?$/;

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
 * @param {string} value SSH target value.
 * @returns {string} Validated SSH target.
 */
function parseSshTarget(value) {
  if (!SSH_TARGET_PATTERN.test(value)) {
    throw new Error(
      '--ssh-target must be a host target such as host, user@host, or host:22'
    );
  }
  return value;
}

/**
 * @param {string} value Remote app directory.
 * @returns {string} Validated remote directory.
 */
function parseRemoteDir(value) {
  if (value.startsWith('-') || value.includes('\0')) {
    throw new Error('--remote-dir must be a remote directory path');
  }
  return value;
}

/**
 * @param {string} value Local media root.
 * @returns {string} Validated local media root.
 */
function parseLocalRoot(value) {
  const normalized = path.normalize(value);
  if (
    path.isAbsolute(value) ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`) ||
    normalized.startsWith('-') ||
    normalized.includes('\0')
  ) {
    throw new Error('--local-root must be a relative path inside this repo');
  }
  return normalized;
}

/**
 * @param {SyncOptions} options Current options.
 * @param {string} flag Parsed flag.
 * @param {string} value Parsed value.
 * @returns {void}
 */
function withOption(options, flag, value) {
  if (flag === '--ssh-target') {
    Object.assign(options, { sshTarget: parseSshTarget(value) });
    return;
  }
  if (flag === '--remote-dir') {
    Object.assign(options, { remoteDir: parseRemoteDir(value) });
    return;
  }
  if (flag === '--local-root') {
    Object.assign(options, { localRoot: parseLocalRoot(value) });
    return;
  }
  throw new Error(`Unknown option: ${flag}`);
}

/**
 * @param {string} arg CLI argument.
 * @returns {{ flag: string; value: string } | null} Inline option.
 */
function parseInlineOption(arg) {
  const equalsIndex = arg.indexOf('=');
  if (equalsIndex === -1) {
    return null;
  }
  return {
    flag: arg.slice(0, equalsIndex),
    value: arg.slice(equalsIndex + 1),
  };
}

/**
 * @param {string[]} args CLI arguments.
 * @returns {SyncOptions} Parsed sync options.
 */
function parseArgs(args) {
  const options = {
    localRoot: parseLocalRoot(DEFAULT_LOCAL_ROOT),
    remoteDir: parseRemoteDir(DEFAULT_REMOTE_DIR),
    showHelp: false,
    sshTarget: parseSshTarget(DEFAULT_SSH_TARGET),
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--help' || arg === '-h') {
      Object.assign(options, { showHelp: true });
      continue;
    }
    const inlineOption = parseInlineOption(arg);
    if (inlineOption) {
      withOption(options, inlineOption.flag, inlineOption.value);
      continue;
    }
    if (arg.startsWith('--')) {
      withOption(options, arg, parseArgValue(args, index, arg));
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
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
