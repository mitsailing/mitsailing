import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zmodel = readFileSync('zenstack/schema.zmodel', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260604133000_event_learn_to_sail_management/migration.sql',
  'utf8'
);
const legalSnapshotMigration = readFileSync(
  'prisma/migrations/20260605152000_legal_agreement_acceptance_snapshots/migration.sql',
  'utf8'
);
const compactZmodel = zmodel.replaceAll(/\s+/g, ' ');
const compactMigration = [migration, legalSnapshotMigration]
  .join('\n')
  .replaceAll(/\s+/g, ' ');

describe('account deletion privacy schema', () => {
  it('minimizes audit data before deleting the user account', () => {
    expect(compactZmodel).toContain(
      'user User? @relation(fields: [userId], references: [id], onDelete: SetNull)'
    );
    expect(compactZmodel).toContain(
      'impersonatedUser User? @relation("UserAuditImpersonatedUser", fields: [impersonatedUserId], references: [id], onDelete: SetNull)'
    );
    expect(migration).toContain('user_account_deletion_privacy_cleanup');
    expect(legalSnapshotMigration).toContain('pg_trigger');
    expect(legalSnapshotMigration).toContain(
      'user_account_deletion_privacy_cleanup_trigger'
    );
    expect(legalSnapshotMigration).toContain(
      'EXECUTE FUNCTION user_account_deletion_privacy_cleanup()'
    );
    expect(compactMigration).toContain('UPDATE "audit_log"');
    expect(compactMigration).toContain('"ip_address" = NULL');
    expect(compactMigration).toContain('"user_agent" = NULL');
    expect(compactMigration).toContain('"metadata" = NULL');
    expect(compactMigration).toContain('UPDATE "user_audit"');
    expect(compactMigration).toContain('"remote_address" = NULL');
    expect(compactMigration).toContain('DELETE FROM "user_audit"');
    expect(compactMigration).toContain('"auditable_type" = \'user\'');
    expect(compactMigration).toContain('UPDATE "legal_agreement_acceptances"');
    expect(compactMigration).toContain('"accepted_user_id" = NULL');
    expect(compactMigration).toContain('"accepted_user_name" = NULL');
    expect(compactMigration).toContain('"accepted_user_email" = NULL');
    expect(compactMigration).not.toContain(
      'UPDATE "event_registrations" SET "status" = \'cancelled\'::"EventRegistrationStatus"'
    );
  });
});
