import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zmodel = readFileSync('zenstack/schema.zmodel', 'utf8');
const prismaSchema = readFileSync('prisma/schema.prisma', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260604133000_event_learn_to_sail_management/migration.sql',
  'utf8'
);
const legalSnapshotMigration = readFileSync(
  'prisma/migrations/20260605152000_legal_agreement_acceptance_snapshots/migration.sql',
  'utf8'
);
const compactZmodel = zmodel.replaceAll(/\s+/g, ' ');
const compactPrismaSchema = prismaSchema.replaceAll(/\s+/g, ' ');
const compactMigration = migration.replaceAll(/\s+/g, ' ');
const compactLegalSnapshotMigration = legalSnapshotMigration.replaceAll(
  /\s+/g,
  ' '
);

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
    expect(compactZmodel).not.toContain('closed_by_account_deletion');
    expect(migration).not.toContain("'closed_by_account_deletion'");
  });

  it('deletes event registrations with the user account', () => {
    expect(compactZmodel).toContain('model EventRegistration');
    expect(compactZmodel).toContain('userId String @map("user_id")');
    expect(compactZmodel).toContain('phone String @trim() @map("phone")');
    expect(compactZmodel).toContain(
      'user User @relation(fields: [userId], references: [id], onDelete: Cascade)'
    );
    expect(migration).not.toContain(
      'CONSTRAINT "event_registrations_live_user_phone_required"'
    );
    expect(migration).not.toContain(
      'CREATE TRIGGER user_account_deletion_event_registration_cleanup_trigger'
    );
    expect(migration).not.toContain('ALTER COLUMN "user_id" DROP NOT NULL');
    expect(migration).not.toContain('ALTER COLUMN "phone" DROP NOT NULL');
    expect(compactMigration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
    expect(compactZmodel).not.toContain('EventRegistrationLifecycleEvent');
    expect(migration).not.toContain(
      'CREATE TABLE "event_registration_lifecycle_events"'
    );
  });

  it('deletes local payment rows only when they match their user registration', () => {
    expect(compactZmodel).toContain(
      'registration EventRegistration? @relation(fields: [registrationId, eventId, userId], references: [id, eventId, userId], onDelete: Cascade)'
    );
    expect(compactPrismaSchema).toContain(
      'registration EventRegistration? @relation(fields: [registrationId, eventId, userId], references: [id, eventId, userId], onDelete: Cascade)'
    );
    expect(compactZmodel).toContain(
      'user User? @relation(fields: [userId], references: [id], onDelete: Cascade)'
    );
    expect(compactZmodel).toContain('@@unique([id, eventId, userId])');
    expect(compactPrismaSchema).toContain('@@unique([id, eventId, userId])');
    expect(compactZmodel).toContain(
      '@@unique([registrationId, eventId, userId])'
    );
    expect(compactPrismaSchema).toContain(
      '@@unique([registrationId, eventId, userId])'
    );
    expect(compactZmodel).toContain(
      'registrationId != null && ( eventId == null || userId == null )'
    );
    expect(compactLegalSnapshotMigration).toContain(
      '"registration_id" IS NOT NULL AND ( "event_id" IS NULL OR "user_id" IS NULL OR NOT EXISTS'
    );
    expect(compactLegalSnapshotMigration).toContain(
      'payments table contains registration_id rows that would violate payments_registration_id_event_id_user_id_fkey'
    );
    expect(compactLegalSnapshotMigration).toContain(
      'FOREIGN KEY ("registration_id", "event_id", "user_id") REFERENCES "event_registrations"("id", "event_id", "user_id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
    expect(compactMigration).toContain(
      'FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE'
    );
  });
});
