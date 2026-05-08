import { describe, expect, it } from 'vitest';
import {
  parseStoredSiteAlertBannerCollapse,
  serializeSiteAlertBannerCollapse,
  siteAlertBannerStartsCollapsed,
} from '@/libs/mit-sailing/siteAlertBannerCollapse';

describe('siteAlertBannerStartsCollapsed', () => {
  it('preserves collapsed state for matching fingerprint', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentFingerprint: 'active-alerts',
        storedFingerprint: 'active-alerts',
      })
    ).toBe(true);
  });

  it('expands for changed fingerprint', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentFingerprint: 'updated-alerts',
        storedFingerprint: 'active-alerts',
      })
    ).toBe(false);
  });
});

describe('parseStoredSiteAlertBannerCollapse', () => {
  it('reads serialized collapse fingerprint', () => {
    expect(
      parseStoredSiteAlertBannerCollapse(
        serializeSiteAlertBannerCollapse('active-alerts')
      )
    ).toBe('active-alerts');
  });

  it('ignores invalid storage values', () => {
    expect(parseStoredSiteAlertBannerCollapse('{')).toBeNull();
    expect(
      parseStoredSiteAlertBannerCollapse('{"collapsed":false}')
    ).toBeNull();
  });
});
