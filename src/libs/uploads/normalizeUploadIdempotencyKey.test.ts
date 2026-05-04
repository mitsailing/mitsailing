import { describe, expect, it } from 'vitest';
import { normalizeUploadIdempotencyKey } from '@/libs/uploads/normalizeUploadIdempotencyKey';

describe('normalizeUploadIdempotencyKey', () => {
  it('returns null for empty or oversized values', () => {
    expect(normalizeUploadIdempotencyKey(null)).toBeNull();
    expect(normalizeUploadIdempotencyKey('')).toBeNull();
    expect(normalizeUploadIdempotencyKey('   ')).toBeNull();
    expect(normalizeUploadIdempotencyKey('a'.repeat(201))).toBeNull();
  });

  it('returns trimmed key', () => {
    expect(normalizeUploadIdempotencyKey('  abc  ')).toBe('abc');
    expect(normalizeUploadIdempotencyKey('a'.repeat(200))).toBe(
      'a'.repeat(200)
    );
  });
});
