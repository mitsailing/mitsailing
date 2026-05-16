import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('prisma/schema.prisma', 'utf8');
const newsletterMigration = readFileSync(
  'prisma/migrations/20260508120000_newsletters/migration.sql',
  'utf8'
);
const emailMessagesMigration = readFileSync(
  'prisma/migrations/20260513130000_email_messages/migration.sql',
  'utf8'
);

describe('newsletter database constraints', () => {
  it('enforces one default newsletter template in the migration', () => {
    expect(newsletterMigration).toContain(
      'CREATE UNIQUE INDEX "newsletter_templates_single_default_key" ON "newsletter_templates"("is_default") WHERE "is_default" = true;'
    );
  });

  it('scopes email provider ids by provider in schema and migrations', () => {
    expect(schema).toContain('@@unique([provider, providerMessageId])');
    expect(schema).toContain('@@unique([provider, providerEventId])');
    expect(emailMessagesMigration).toContain(
      'CREATE UNIQUE INDEX "email_messages_provider_provider_message_id_key" ON "email_messages"("provider", "provider_message_id");'
    );
    expect(emailMessagesMigration).toContain(
      'CREATE UNIQUE INDEX "email_message_events_provider_provider_event_id_key" ON "email_message_events"("provider", "provider_event_id");'
    );
  });
});
