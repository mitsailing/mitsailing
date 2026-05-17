import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

function shellVariable(value: string): string {
  return `${String.fromCodePoint(36)}{${value}}`;
}

describe('single host deploy script', () => {
  const script = readRepoFile('bin/deploy.sh');
  const deployDrainSeconds = `${shellVariable('DEPLOY_DRAIN_SECONDS')}s`;

  it('keeps nginx upload timeouts aligned with the drain window default', () => {
    expect(script).toContain('DEPLOY_DRAIN_SECONDS:-900');
    expect(script).toContain(`client_body_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_send_timeout ${deployDrainSeconds};`);
    expect(script).toContain(`proxy_read_timeout ${deployDrainSeconds};`);
  });
});
