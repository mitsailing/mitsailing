import { describe, expect, it } from 'vitest';
import { newsletterBroadcastStatusKey } from '@/libs/newsletter/newsletterAdminDisplay';

describe('newsletter admin display', () => {
  it('maps known broadcast statuses', () => {
    expect(newsletterBroadcastStatusKey('sent')).toBe('status_sent');
  });

  it('maps unknown broadcast statuses', () => {
    expect(newsletterBroadcastStatusKey('deferred')).toBe('status_unknown');
  });

  it('rejects prototype keys as broadcast statuses', () => {
    expect(newsletterBroadcastStatusKey('toString')).toBe('status_unknown');
  });
});
