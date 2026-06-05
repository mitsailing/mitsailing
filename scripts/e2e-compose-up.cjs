/**
 * Starts docker-compose services with media upload endpoints aligned to the
 * Playwright standalone server origin.
 */
const { spawnSync } = require('node:child_process');

const port = String(process.env.PLAYWRIGHT_E2E_PORT ?? '3008');
const fallbackAppUrl = `http://localhost:${port}`;
const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? fallbackAppUrl);

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

const result = spawnSync(
  'docker',
  ['compose', 'up', '-d', 'postgres', 'mailpit', 'redis', 'tusd', 'media'],
  {
    stdio: 'inherit',
  }
);

if (result.error) {
  console.error(`[e2e-compose-up] ${result.error.message}`);
}

process.exit(result.status ?? 1);
