type ChecklyEnv = Record<string, string | undefined>;

function checklyEnvValue(env: ChecklyEnv, key: string) {
  const value = env[key]?.trim();
  if (!value) {
    return;
  }
  return value;
}

export function checklyEnvironmentUrl(env: ChecklyEnv) {
  return (
    checklyEnvValue(env, 'ENVIRONMENT_URL') ??
    checklyEnvValue(env, 'NEXT_PUBLIC_APP_URL') ??
    'http://localhost:3000'
  );
}

export function checklyHealthcheckSecret(env: ChecklyEnv) {
  return checklyEnvValue(env, 'HEALTHCHECK_SECRET');
}
