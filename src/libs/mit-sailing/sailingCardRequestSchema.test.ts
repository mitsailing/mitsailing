import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync('zenstack/schema.zmodel', 'utf8');
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
});
