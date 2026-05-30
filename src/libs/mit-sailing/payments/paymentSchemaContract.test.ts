import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zmodel = readFileSync('zenstack/schema.zmodel', 'utf8');
const migration = readFileSync(
  'prisma/migrations/20260529183000_membership_payment_admin_status/migration.sql',
  'utf8'
);

describe('payment schema contract', () => {
  it('broadens event payments with one purpose column for membership rows', () => {
    expect(zmodel).toContain('enum PaymentPurpose');
    expect(zmodel).toContain('event');
    expect(zmodel).toContain('membership');
    expect(zmodel).toContain('model Payment');
    expect(zmodel).toContain('purpose                 PaymentPurpose');
    expect(zmodel).toContain('cardYear');
    expect(zmodel).toContain('stripeSubscriptionId');
    expect(zmodel).toContain('stripeInvoiceId');
    expect(zmodel).not.toContain('model SailingCardMembershipPayment');
  });

  it('keeps event and membership fields mutually exclusive in SQL', () => {
    expect(migration).toContain(
      'ALTER TABLE "event_payments" RENAME TO "payments"'
    );
    expect(migration).toContain('"payments_event_fields_chk"');
    expect(migration).toContain('"payments_membership_fields_chk"');
    expect(migration).toContain('"purpose" <> \'membership\'');
    expect(migration).toContain('"card_year" IS NOT NULL');
    expect(migration).toContain('"card_type" IS NOT NULL');
  });

  it('prevents non-Stripe rows from claiming Stripe artifacts', () => {
    expect(migration).toContain('"payments_non_stripe_no_stripe_fields_chk"');
    expect(migration).toContain(
      "\"source\" NOT IN ('legacy', 'admin_override')"
    );
    expect(migration).toContain('"stripe_receipt_url" IS NULL');
  });

  it('keeps payment classification immutable without ZenStack enum before comparisons', () => {
    expect(zmodel).toContain('payments_prevent_classification_change');
    expect(migration).toContain(
      'CREATE FUNCTION payments_prevent_classification_change()'
    );
    expect(migration).toContain(
      'BEFORE UPDATE OF "purpose", "source", "card_type"'
    );
    expect(migration).toContain(
      'payment classification fields are immutable after create'
    );
  });

  it('stores legacy payment evidence without requiring an app user', () => {
    expect(zmodel).toContain('legacyCategory');
    expect(zmodel).toContain('legacyDescription');
    expect(zmodel).toContain('legacySettled');
    expect(zmodel).toContain('payerEmail');
    expect(zmodel).toContain('userId                  String?');
    expect(migration).toContain('"legacy_category" TEXT');
    expect(migration).toContain('"legacy_settled" BOOLEAN');
    expect(migration).toContain('ALTER COLUMN "user_id" DROP NOT NULL');
  });
});
