import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const zmodel = readFileSync('zenstack/schema.zmodel', 'utf8');
const compactSql = (value: string) => value.replaceAll(/\s+/g, ' ').trim();
const compactZmodel = compactSql(zmodel);
const migration = readFileSync(
  'prisma/migrations/20260531223000_add_sailing_card_subscriptions/migration.sql',
  'utf8'
);
const issueHandledKindMigration = readFileSync(
  'prisma/migrations/20260602143000_payment_issue_handled_kind_check/migration.sql',
  'utf8'
);
const paymentIssueHandledConstraint = compactSql(
  issueHandledKindMigration
).match(/ADD CONSTRAINT "payments_issue_handled_fields_chk" CHECK \(.+\)/);
const expectedPaymentIssueHandledConstraint =
  'ADD CONSTRAINT "payments_issue_handled_fields_chk" CHECK ( ( "issue_handled_at" IS NULL AND "issue_handled_note" IS NULL AND "issue_handled_by_user_id" IS NULL ) OR ( "issue_kind" IS NOT NULL AND "issue_handled_at" IS NOT NULL AND "issue_handled_note" IS NOT NULL AND length(trim("issue_handled_note")) >= 1 AND "issue_handled_by_user_id" IS NOT NULL ) )';
const expectedPaymentIssueHandledPolicy =
  "(issueHandledAt != null || issueHandledNote != null || issueHandledByUserId != null) && (issueHandledAt == null || issueHandledNote == null || issueHandledNote == '' || issueHandledByUserId == null || issueKind == null)";
const paymentIssueHandledPolicy = compactZmodel.match(
  /@@deny\('create,update', \(issueHandledAt != null.+?issueKind == null\)\)/
);

describe('membership subscription schema contract', () => {
  it('stores Stripe subscription state in one local subscription model', () => {
    expect(compactZmodel).toContain('model SailingCardSubscription');
    expect(compactZmodel).toContain('userId String @map("user_id")');
    expect(compactZmodel).toContain(
      'cardType SailingCardType @map("card_type")'
    );
    expect(compactZmodel).toContain(
      'stripeCustomerId String @map("stripe_customer_id")'
    );
    expect(compactZmodel).toContain(
      'stripeSubscriptionId String @unique @map("stripe_subscription_id")'
    );
    expect(compactZmodel).toContain('stripeSubscriptionItemId');
    expect(compactZmodel).toContain('currentPeriodStart');
    expect(compactZmodel).toContain('currentPeriodEnd');
    expect(compactZmodel).toContain('cancelAtPeriodEnd');
    expect(compactZmodel).toContain('autoRenew Boolean @default(true)');
    expect(compactZmodel).toContain('lastStripeSubscriptionEventId');
    expect(compactZmodel).toContain('@@map("sailing_card_subscriptions")');
    expect(compactZmodel).not.toContain('model SailingCardMembershipPayment');
    expect(compactZmodel).not.toContain('model SailingCardMembershipRefund');
  });

  it('keeps membership charges in the shared payments table', () => {
    expect(compactZmodel).toContain(
      'membershipSubscriptionId String? @map("membership_subscription_id")'
    );
    expect(compactZmodel).toContain(
      'membershipPaymentKind MembershipPaymentKind? @map("membership_payment_kind")'
    );
    expect(compactZmodel).toContain('activeCheckoutKey String? @unique');
    expect(compactZmodel).toContain('stripeCheckoutSessionUrl');
    expect(compactZmodel).toContain('stripeCheckoutSessionExpiresAt');
    expect(compactZmodel).toContain('stripeHostedInvoiceUrl');
    expect(compactZmodel).toContain('stripeInvoicePdfUrl');
    expect(compactZmodel).toContain('stripeInvoiceLineItemId');
    expect(compactZmodel).toContain('stripeRefundId');
    expect(compactZmodel).toContain('stripeDisputeId');
    expect(compactZmodel).toContain('refundedAmountCents');
    expect(compactZmodel).toContain('issueKind');
    expect(compactZmodel).toContain('issueHandledByUserId');
    expect(paymentIssueHandledPolicy?.[0]).toContain(
      expectedPaymentIssueHandledPolicy
    );
    expect(paymentIssueHandledConstraint?.[0]).toBe(
      expectedPaymentIssueHandledConstraint
    );
    expect(compactZmodel).toContain('membershipConsentSnapshot Json?');
    expect(compactZmodel).toContain('source != stripe && (');
    expect(compactZmodel).toContain(
      "@@deny('create,update', refundedAmountCents != null && refundedAmountCents > amountCents)"
    );
  });

  it('requires a cancellation reason when auto-renew cancellation is requested', () => {
    expect(compactZmodel).toContain(
      "@@deny('create,update', cancellationRequestedAt != null && cancellationReason == null)"
    );
    expect(migration).toContain(
      'CONSTRAINT "sailing_card_subscriptions_cancel_reason_required_chk"'
    );
    expect(migration).toContain('"cancellation_requested_at" IS NULL');
    expect(migration).toContain('"cancellation_reason" IS NOT NULL');
  });

  it('allows one Stripe subscription to produce many payment rows', () => {
    expect(compactZmodel).not.toContain(
      'stripeSubscriptionId String? @unique @map("stripe_subscription_id")'
    );
    expect(compactZmodel).toContain(
      '@@index([stripeSubscriptionId, stripeInvoiceId])'
    );
    expect(migration).toContain(
      'DROP CONSTRAINT IF EXISTS "payments_stripe_subscription_id_key"'
    );
    expect(migration).toContain(
      'DROP INDEX IF EXISTS "payments_stripe_subscription_id_key"'
    );
    expect(migration).toContain(
      'CREATE INDEX "payments_stripe_subscription_id_stripe_invoice_id_idx"'
    );
  });
});
