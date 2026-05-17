#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_REMOTE_DIR = 'apps/mitsailing';
const DEFAULT_LOCAL_ROOT = 'local/cms-media';
const REMOTE_MEDIA_ROOT = '/var/lib/mitsailing/cms-media';
const SAFE_REMOTE_DIR_PATTERN = /^\/?[A-Za-z0-9._~/-]+$/;
const MKDIR_BIN = '/bin/mkdir';
const SSH_BIN = '/usr/bin/ssh';
const TAR_BIN = '/usr/bin/tar';

/**
 * @typedef {object} SyncOptions
 * @property {string} localRoot Local CMS media root.
 * @property {string} remoteDir Remote app directory.
 * @property {boolean} showHelp Whether to print help and exit.
 * @property {string | undefined} sshTarget SSH target for the production host.
 */

/**
 * @returns {string} CLI help text.
 */
function usage() {
  return `Usage: node scripts/sync-prod-media.mjs [options]

Downloads production CMS ready media into the local gitignored media tree.

Options:
  --ssh-target <target>  SSH target for the production host.
                         Defaults to PRODUCTION_SSH_TARGET.
  --remote-dir <path>    App directory on the production host.
                         Default: ${DEFAULT_REMOTE_DIR}
  --local-root <path>    Local CMS media root. The script extracts ready/ here.
                         Default: ${DEFAULT_LOCAL_ROOT}
  --help                 Show this help text.
`;
}

/**
 * @param {string} value SSH target value.
 * @returns {string} Validated SSH target.
 */
function parseSshTarget(value) {
  const [hostOrUser, host = ''] = value.split('@');
  if (
    !validSshTargetParts({
      host,
      hostOrUser,
      value,
    })
  ) {
    throw new Error(
      '--ssh-target must be a host target such as host or user@host'
    );
  }
  return value;
}

/**
 * @param {{ host: string; hostOrUser: string; value: string }} props SSH target parts.
 * @returns {boolean} Whether the SSH target parts are valid.
 */
function validSshTargetParts(props) {
  if (!validSshTargetShape(props)) {
    return false;
  }
  return validSshTargetTokens(props);
}

/**
 * @param {{ host: string; hostOrUser: string; value: string }} props SSH target parts.
 * @returns {boolean} Whether the target has a valid host/user shape.
 */
function validSshTargetShape(props) {
  const hasUserSeparator = props.value.includes('@');
  return (
    !props.value.includes(':') &&
    props.value.split('@').length <= 2 &&
    (!hasUserSeparator ||
      (props.host.length > 0 && props.hostOrUser.length > 0))
  );
}

/**
 * @param {{ host: string; hostOrUser: string }} props SSH target parts.
 * @returns {boolean} Whether the host and optional user tokens are valid.
 */
function validSshTargetTokens(props) {
  const hostValue = props.host || props.hostOrUser;
  const userValue = props.host ? props.hostOrUser : '';
  return validSshToken(hostValue) && validOptionalSshUser(userValue);
}

/**
 * @param {string} value SSH username or host token.
 * @returns {boolean} Whether the token is safe for an SSH target.
 */
function validSshToken(value) {
  if (value.length === 0 || value.startsWith('-')) {
    return false;
  }
  for (let index = 0; index < value.length; index += 1) {
    const code = value.codePointAt(index);
    if (code === undefined || !validSshTokenCharacter(code)) {
      return false;
    }
  }
  return true;
}

/**
 * @param {number} code Character code.
 * @returns {boolean} Whether the character is safe for an SSH target token.
 */
function validSshTokenCharacter(code) {
  return (
    isAsciiUppercase(code) ||
    isAsciiLowercase(code) ||
    isAsciiDigit(code) ||
    isSshTokenPunctuation(code)
  );
}

/**
 * @param {number} code Character code.
 * @returns {boolean} Whether the character is A-Z.
 */
function isAsciiUppercase(code) {
  return code >= 65 && code <= 90;
}

/**
 * @param {number} code Character code.
 * @returns {boolean} Whether the character is a-z.
 */
function isAsciiLowercase(code) {
  return code >= 97 && code <= 122;
}

/**
 * @param {number} code Character code.
 * @returns {boolean} Whether the character is 0-9.
 */
function isAsciiDigit(code) {
  return code >= 48 && code <= 57;
}

/**
 * @param {number} code Character code.
 * @returns {boolean} Whether the character is safe punctuation.
 */
function isSshTokenPunctuation(code) {
  return code === 46 || code === 95 || code === 126 || code === 45;
}

/**
 * @param {string} value Optional SSH username token.
 * @returns {boolean} Whether the optional user is valid.
 */
function validOptionalSshUser(value) {
  return value.length === 0 || validSshToken(value);
}

/**
 * @param {string | undefined} cliTarget CLI target override.
 * @returns {string} Resolved SSH target.
 */
function resolveSshTarget(cliTarget) {
  const target = cliTarget ?? process.env.PRODUCTION_SSH_TARGET;
  if (!target) {
    throw new Error(
      'Set PRODUCTION_SSH_TARGET or pass --ssh-target before syncing media.'
    );
  }
  return parseSshTarget(target);
}

/**
 * @param {string} value Remote app directory.
 * @returns {string} Validated remote directory.
 */
function parseRemoteDir(value) {
  if (
    value.startsWith('-') ||
    value === '..' ||
    value.startsWith('../') ||
    value.includes('/../') ||
    !SAFE_REMOTE_DIR_PATTERN.test(value)
  ) {
    throw new Error(
      '--remote-dir must be a remote directory path with safe characters'
    );
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
    options.sshTarget = parseSshTarget(value);
    return;
  }
  if (flag === '--remote-dir') {
    options.remoteDir = parseRemoteDir(value);
    return;
  }
  if (flag === '--local-root') {
    options.localRoot = parseLocalRoot(value);
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
  const flag = arg.slice(0, equalsIndex);
  const value = arg.slice(equalsIndex + 1);
  if (value.length === 0) {
    throw new Error(`${flag} requires a value`);
  }
  return {
    flag,
    value,
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
    sshTarget: undefined,
  };
  const iterator = args.values();
  for (const arg of iterator) {
    if (arg === '--help' || arg === '-h') {
      options.showHelp = true;
      continue;
    }
    const inlineOption = parseInlineOption(arg);
    if (inlineOption) {
      withOption(options, inlineOption.flag, inlineOption.value);
      continue;
    }
    if (arg.startsWith('--')) {
      withOption(options, arg, parseIteratorArgValue(iterator, arg));
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }
  return options;
}

/**
 * @param {ArrayIterator<string>} iterator CLI argument iterator.
 * @param {string} flag Flag that requires a value.
 * @returns {string} Parsed flag value.
 */
function parseIteratorArgValue(iterator, flag) {
  const result = iterator.next();
  if (result.done || result.value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return result.value;
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
 * @returns {Promise<void>} Resolves when media sync completes.
 */
async function syncReadyMedia(options) {
  const localRoot = path.resolve(options.localRoot);
  if (!localRoot.startsWith(`${process.cwd()}${path.sep}`)) {
    throw new Error('--local-root must resolve inside this repo');
  }
  createLocalRoot(localRoot);
  await extractRemoteReadyMedia({
    localRoot,
    remoteCommand: remoteTarCommand(options.remoteDir),
    sshTarget: options.sshTarget,
  });
  process.stdout.write(`Synced production ready media into ${localRoot}\n`);
}

/**
 * @param {string} localRoot Local media root.
 * @returns {void}
 */
function createLocalRoot(localRoot) {
  const result = spawnSync(MKDIR_BIN, ['-p', localRoot], {
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`mkdir failed with exit code ${result.status}`);
  }
}

/**
 * @param {{ localRoot: string; remoteCommand: string; sshTarget: string }} options Extraction options.
 * @returns {Promise<void>} Resolves when both child processes complete.
 */
async function extractRemoteReadyMedia(options) {
  const ssh = spawn(SSH_BIN, [options.sshTarget, options.remoteCommand], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const tar = spawn(TAR_BIN, ['-xpf', '-', '-C', options.localRoot], {
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (ssh.stdout === null || tar.stdin === null) {
    throw new Error('media sync failed to create process pipe');
  }
  ssh.stdout.pipe(tar.stdin);
  const [sshStatus, tarStatus] = await Promise.all([
    waitForChildProcess({ child: ssh, name: 'ssh' }),
    waitForChildProcess({ child: tar, name: 'tar' }),
  ]);
  if (sshStatus !== 0) {
    throw new Error(`ssh failed with exit code ${sshStatus}`);
  }
  if (tarStatus !== 0) {
    throw new Error(`tar failed with exit code ${tarStatus}`);
  }
}

/**
 * @param {{ child: import('node:child_process').ChildProcess; name: string }} options Child process.
 * @returns {Promise<number | null>} Resolves with the exit code.
 */
async function waitForChildProcess(options) {
  const [codeOrError, signal] = await Promise.race([
    once(options.child, 'close'),
    once(options.child, 'error'),
  ]);
  if (codeOrError instanceof Error) {
    throw codeOrError;
  }
  if (signal) {
    throw new Error(`${options.name} failed with signal ${signal}`);
  }
  if (typeof codeOrError === 'number') {
    return codeOrError;
  }
  if (codeOrError === null) {
    return null;
  }
  throw new TypeError(`${options.name} exited without a status code`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.showHelp) {
    process.stdout.write(usage());
    return;
  }
  await syncReadyMedia({
    ...options,
    sshTarget: resolveSshTarget(options.sshTarget),
  });
}

try {
  await main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
