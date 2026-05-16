import { describe, expect, it } from 'vitest';
import { emailDeliverabilityStatus } from '@/libs/email/emailDeliverabilityStatus';

describe('emailDeliverabilityStatus', () => {
  it('returns ok without provider delivery flags', () => {
    expect(
      emailDeliverabilityStatus({
        emailBouncedAt: null,
        emailSuppressedAt: null,
        emailSuppressionReason: null,
      })
    ).toBe('ok');
  });

  it('returns bounced for bounced account email', () => {
    expect(
      emailDeliverabilityStatus({
        emailBouncedAt: new Date('2026-05-01T12:00:00.000Z'),
        emailSuppressedAt: null,
        emailSuppressionReason: null,
      })
    ).toBe('bounced');
  });

  it('returns suppressed before bounced', () => {
    expect(
      emailDeliverabilityStatus({
        emailBouncedAt: new Date('2026-05-01T12:00:00.000Z'),
        emailSuppressedAt: new Date('2026-05-02T12:00:00.000Z'),
        emailSuppressionReason: 'complained',
      })
    ).toBe('suppressed');
  });
});
