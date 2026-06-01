import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('zenstack/schema.zmodel', 'utf8');
const membershipPriceMigration = readFileSync(
  'prisma/migrations/20260531201000_add_sailing_card_membership_prices/migration.sql',
  'utf8'
);
const compactSchema = schema.replaceAll(/\s+/g, ' ');

describe('sailing card request schema', () => {
  it('stores one annual sailing-card request per user and year', () => {
    expect(schema).toContain('model SailingCardRequest');
    expect(schema).toContain('userId');
    expect(schema).toContain('cardYear');
    expect(compactSchema).toContain('status SailingCardRequestStatus');
    expect(compactSchema).toContain('cardType SailingCardType');
    expect(schema).toContain('legalAgreementAcceptanceId');
    expect(compactSchema).toContain('user User @relation');
    expect(schema).toContain(
      'legalAgreementAcceptance LegalAgreementAcceptance @relation'
    );
    expect(schema).toContain('@@unique([userId, cardYear])');
  });

  it('requires complete payment bypass evidence in policy and database schema', () => {
    expect(schema).toContain(
      'paymentBypassNote          String?                  @trim @length(min: 3)'
    );
    expect(schema).toContain(
      'paymentBypassAt != null && (paymentBypassNote == null || paymentBypassByUserId == null)'
    );
  });

  it('preserves MIT Recreation self-report on sailing card requests', () => {
    expect(compactSchema).toContain('hasFitnessMembership Boolean?');
    expect(compactSchema).toContain('@map("has_fitness_membership")');
  });

  it('stores effective-dated sailing card membership prices', () => {
    expect(compactSchema).toContain('model SailingCardMembershipPrice');
    expect(compactSchema).toContain('enum SailingCardMembershipPriceKind');
    expect(compactSchema).toContain('enum SailingCardMembershipPriceCategory');
    expect(compactSchema).toContain(
      'enum SailingCardMembershipBillingInterval'
    );
    expect(compactSchema).toContain('model Payment');
    expect(compactSchema).toContain('purpose PaymentPurpose');
    expect(compactSchema).toContain('membership');
    expect(compactSchema).toContain('active Boolean @default(true)');
    expect(compactSchema).toContain(
      'priceKind == spring && billingInterval == annual'
    );
    expect(compactSchema).toContain(
      'effectiveAt DateTime @map("effective_at")'
    );
    expect(compactSchema).toContain('priceCategory');
    expect(compactSchema).not.toContain('@map("retired_at")');
    expect(compactSchema).not.toContain('model SailingCardMembershipPayment');
    expect(compactSchema).not.toContain('model SailingCardMembershipRefund');
    expect(membershipPriceMigration).toContain(
      'sailing_card_membership_prices_prevent_catalog_key_change'
    );
    expect(compactSchema).toContain("@@deny('post-update'");
    expect(compactSchema).not.toContain('cardType != before().cardType');
    expect(compactSchema).not.toContain('priceKind != before().priceKind');
    expect(compactSchema).not.toContain(
      'priceCategory != before().priceCategory'
    );
    expect(compactSchema).not.toContain(
      'billingInterval != before().billingInterval'
    );
    expect(compactSchema).toContain('amountCents != before().amountCents');
    expect(compactSchema).toContain(
      'before().stripePriceId != null && (stripePriceId == null || stripePriceId != before().stripePriceId)'
    );
    expect(membershipPriceMigration).toContain(
      'sailing_card_membership_prices_price_kind_interval_chk'
    );
    expect(membershipPriceMigration).toContain(
      'OLD.stripe_price_id IS NOT NULL'
    );
    expect(membershipPriceMigration).toContain(
      'NEW.stripe_price_id IS DISTINCT FROM OLD.stripe_price_id'
    );
  });
});
