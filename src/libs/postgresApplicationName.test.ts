import { describe, expect, it } from 'vitest';
import { postgresApplicationName } from '@/libs/postgresApplicationName';

describe('postgresApplicationName', () => {
  it('returns mitsailing-worker when argv includes worker.mjs', () => {
    expect(postgresApplicationName(['node', '/app/worker.mjs'])).toBe(
      'mitsailing-worker'
    );
  });

  it('returns mitsailing-worker when argv includes src/worker', () => {
    expect(postgresApplicationName(['node', '/repo/src/worker/index.ts'])).toBe(
      'mitsailing-worker'
    );
  });

  it('returns mitsailing-web for server.js', () => {
    expect(postgresApplicationName(['node', '/app/server.js'])).toBe(
      'mitsailing-web'
    );
  });

  it('returns mitsailing-web when argv is empty', () => {
    expect(postgresApplicationName([])).toBe('mitsailing-web');
  });
});
