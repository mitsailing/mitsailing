/**
 * Starts docker-compose services with media upload endpoints aligned to the
 * Playwright standalone server origin.
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const { setTimeout: delay } = require('node:timers/promises');
const {
  prepareLocalMediaStorage,
} = require('./prepare-local-media-storage.cjs');

const port = String(process.env.PLAYWRIGHT_E2E_PORT ?? '3008');
const fallbackAppUrl = `http://localhost:${port}`;
const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? fallbackAppUrl);
const startupTimeoutMs = 60_000;
const dockerExecutablePath = resolveDockerExecutablePath();

/**
 * @param {string} filePath - Candidate executable path.
 * @returns {boolean} Whether the path is executable.
 */
function isExecutable(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveDockerExecutablePath() {
  const candidates = [
    '/usr/bin/docker',
    '/usr/local/bin/docker',
    '/opt/homebrew/bin/docker',
  ];
  const dockerPath = candidates.find(isExecutable);
  if (!dockerPath) {
    console.error(
      `[e2e-compose-up] docker executable not found in fixed paths: ${candidates.join(
        ', '
      )}`
    );
    process.exit(1);
  }
  return dockerPath;
}

/**
 * @param {readonly string[]} args - Docker CLI arguments.
 * @param {import('node:child_process').SpawnSyncOptions} [options] - Spawn options.
 * @returns {import('node:child_process').SpawnSyncReturns<Buffer | string>} Spawn result.
 */
function spawnDocker(args, options = {}) {
  return spawnSync(dockerExecutablePath, args, options);
}

function configureLocalDockerUser() {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 1000;
  const gid = typeof process.getgid === 'function' ? process.getgid() : 1000;
  process.env.LOCAL_DOCKER_UID ??= String(uid);
  process.env.LOCAL_DOCKER_GID ??= String(gid);
}

/**
 * @param {string} value - Candidate app URL.
 * @returns {string} App origin for CORS.
 */
function appOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return fallbackAppUrl;
  }
}

/**
 * @param {string} origin - App origin.
 * @returns {string} Port exposed to Docker containers.
 */
function appPort(origin) {
  const url = new URL(origin);
  if (url.port) {
    return url.port;
  }
  return url.protocol === 'https:' ? '443' : '80';
}

const origin = appOrigin(appUrl);
const hookUrl =
  process.env.MEDIA_UPLOAD_HOOK_URL ??
  `http://host.docker.internal:${appPort(origin)}/api/internal/cms-media/tusd/hooks`;

process.env.MEDIA_UPLOAD_CORS_ALLOW_ORIGIN = origin;
process.env.MEDIA_UPLOAD_HOOK_URL = hookUrl;
process.env.NEXT_PUBLIC_APP_URL = origin;
configureLocalDockerUser();
prepareLocalMediaStorage();

/**
 * @param {unknown} value - Parsed JSON value.
 * @returns {value is Record<string, unknown>} Whether the value is a plain record.
 */
function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * @param {string} value - JSON payload.
 * @returns {unknown} Parsed JSON value.
 */
function parseJson(value) {
  return /** @type {unknown} */ (JSON.parse(value));
}

/**
 * @param {unknown} value - Parsed compose ps payload.
 * @returns {Record<string, unknown>[]} Compose service records.
 */
function composePsRecordsFromValue(value) {
  if (Array.isArray(value)) {
    return value.filter(isRecord);
  }
  return isRecord(value) ? [value] : [];
}

/**
 * @param {string} output - `docker compose ps --format json` output.
 * @returns {Record<string, unknown>[]} Compose service records.
 */
function parseComposePsRecords(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }
  try {
    return composePsRecordsFromValue(parseJson(trimmed));
  } catch {
    return trimmed
      .split(/\r?\n/u)
      .flatMap((line) => composePsRecordsFromValue(parseJson(line)));
  }
}

/**
 * @param {Record<string, unknown> | undefined} record - Compose service record.
 * @param {string} key - Record key.
 * @returns {string} String value, if present.
 */
function stringRecordValue(record, key) {
  if (!record) {
    return '';
  }
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function discoverTusdContainerIdentifier() {
  const result = spawnDocker(['compose', 'ps', '--format', 'json', 'tusd'], {
    encoding: 'utf8',
  });
  if (result.error) {
    console.error(`[e2e-compose-up] ${result.error.message}`);
    return null;
  }
  if (result.status !== 0) {
    console.error('[e2e-compose-up] unable to inspect compose tusd service');
    return null;
  }
  try {
    const records = parseComposePsRecords(result.stdout);
    const tusdRecord =
      records.find(
        (record) => stringRecordValue(record, 'Service') === 'tusd'
      ) ?? records[0];
    const containerIdentifier =
      stringRecordValue(tusdRecord, 'ID') ||
      stringRecordValue(tusdRecord, 'Name') ||
      stringRecordValue(tusdRecord, 'Names');
    return containerIdentifier || null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[e2e-compose-up] unable to parse compose tusd service: ${message}`
    );
    return null;
  }
}

function runDockerDiagnostics() {
  const tusdContainerIdentifier = discoverTusdContainerIdentifier();
  const commands = [['compose', 'ps', '-a']];
  if (tusdContainerIdentifier) {
    commands.push([
      'inspect',
      tusdContainerIdentifier,
      '--format',
      'tusd health: {{json .State.Health}}',
    ]);
  }
  commands.push(['compose', 'logs', 'tusd', '--no-color', '--tail=120']);

  for (const args of commands) {
    const diagnostic = spawnDocker(args, { stdio: 'inherit' });
    if (diagnostic.error) {
      console.error(`[e2e-compose-up] ${diagnostic.error.message}`);
    }
  }
}

const result = spawnDocker(
  [
    'compose',
    'up',
    '--wait',
    '--wait-timeout',
    String(Math.ceil(startupTimeoutMs / 1000)),
    'postgres',
    'mailpit',
    'redis',
    'tusd',
    'media',
  ],
  {
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error(`[e2e-compose-up] ${result.error.message}`);
}

if (result.status !== 0) {
  runDockerDiagnostics();
  process.exit(result.status ?? 1);
}

/**
 * @param {string} url - Health URL exposed on the host network.
 * @param {string} label - Service label for diagnostics.
 */
async function waitForHostHttp(url, label) {
  const deadline = Date.now() + startupTimeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status === 204) {
        return;
      }
      lastError = `${response.status} ${response.statusText}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(1000);
  }
  console.error(`[e2e-compose-up] ${label} not reachable at ${url}`);
  console.error(`[e2e-compose-up] last error: ${lastError}`);
  runDockerDiagnostics();
  process.exit(1);
}

async function main() {
  await waitForHostHttp('http://127.0.0.1:1080/metrics', 'tusd');
  await waitForHostHttp('http://127.0.0.1:8025/readyz', 'mailpit');
  await waitForHostHttp('http://127.0.0.1:8088/cms-media/healthz', 'media');
}

// eslint-disable-next-line no-void -- Top-level async entry point catches and reports failures before exiting.
void (async function run() {
  try {
    await main();
  } catch (error) {
    console.error(
      `[e2e-compose-up] ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
})();
