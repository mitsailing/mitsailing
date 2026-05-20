import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readRepoFile(path: string): string {
  return readFileSync(join(process.cwd(), path), 'utf8');
}

describe('public slug and legacy redirect schema', () => {
  it('defines public slug history and legacy redirect tables', () => {
    const schema = readRepoFile('prisma/schema.prisma');

    expect(schema).toContain('model PublicSlug');
    expect(schema).toContain('model LegacyRedirect');
    expect(schema).toContain('@@unique([slug, sluggableType, scope])');
    expect(schema).toContain('@@index([sluggableType, sluggableId])');
    expect(schema).toContain('sourcePath String @unique() @map("source_path")');
    expect(schema).toContain('@@map("public_slugs")');
    expect(schema).toContain('@@map("legacy_redirects")');
  });
});
