import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zmodel = readFileSync('zenstack/schema.zmodel', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260604133000_event_learn_to_sail_management/migration.sql',
  'utf8'
);
const compactZmodel = zmodel.replaceAll(/\s+/g, ' ');

describe('learnToSailWaitlist schema', () => {
  it('deletes waitlist entries with the user account', () => {
    expect(compactZmodel).toContain('model LearnToSailWaitlistEntry');
    expect(compactZmodel).toContain('userId String @map("user_id")');
    expect(compactZmodel).toContain(
      'user User @relation(fields: [userId], references: [id], onDelete: Cascade)'
    );
    expect(migration).toContain('"user_id" TEXT NOT NULL');
    expect(migration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  });
});
