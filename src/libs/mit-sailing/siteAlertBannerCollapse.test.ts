import { describe, expect, it } from 'vitest';
import {
  buildSiteAlertBannerCollapseAlerts,
  parseStoredSiteAlertBannerCollapse,
  serializeSiteAlertBannerCollapse,
  siteAlertBannerStartsCollapsed,
} from '@/libs/mit-sailing/siteAlertBannerCollapse';
import type { SiteAlertBannerCollapseAlert } from '@/libs/mit-sailing/siteAlertBannerCollapse';

const activeAlerts: SiteAlertBannerCollapseAlert[] = [
  {
    id: 'alert-1',
    contentFingerprint: 'alert-1-content',
  },
  {
    id: 'alert-2',
    contentFingerprint: 'alert-2-content',
  },
];

describe('siteAlertBannerStartsCollapsed', () => {
  it('preserves collapsed state for same alerts', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: activeAlerts,
        storedAlerts: activeAlerts,
      })
    ).toBe(true);
  });

  it('preserves collapsed state after alert removal', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: activeAlerts.slice(0, 1),
        storedAlerts: activeAlerts,
      })
    ).toBe(true);
  });

  it('expands for new alert', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: [
          ...activeAlerts,
          {
            id: 'alert-3',
            contentFingerprint: 'alert-3-content',
          },
        ],
        storedAlerts: activeAlerts,
      })
    ).toBe(false);
  });

  it('expands for edited alert text', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: [
          {
            id: 'alert-1',
            contentFingerprint: 'alert-1-updated-text',
          },
        ],
        storedAlerts: activeAlerts,
      })
    ).toBe(false);
  });

  it('expands for edited alert date', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: [
          {
            id: 'alert-1',
            contentFingerprint: 'alert-1-updated-date',
          },
        ],
        storedAlerts: activeAlerts,
      })
    ).toBe(false);
  });

  it('expands for invalid storage', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: activeAlerts,
        storedAlerts: null,
      })
    ).toBe(false);
  });

  it('does not treat empty current alerts as collapsed', () => {
    expect(
      siteAlertBannerStartsCollapsed({
        currentAlerts: [],
        storedAlerts: activeAlerts,
      })
    ).toBe(false);
  });
});

describe('parseStoredSiteAlertBannerCollapse', () => {
  it('reads serialized collapse alerts', () => {
    expect(
      parseStoredSiteAlertBannerCollapse(
        serializeSiteAlertBannerCollapse(activeAlerts)
      )
    ).toEqual(activeAlerts);
  });

  it('ignores invalid storage values', () => {
    expect(parseStoredSiteAlertBannerCollapse(null)).toBeNull();
    expect(parseStoredSiteAlertBannerCollapse('{')).toBeNull();
    expect(parseStoredSiteAlertBannerCollapse('0')).toBeNull();
    expect(
      parseStoredSiteAlertBannerCollapse('{"collapsed":false}')
    ).toBeNull();
  });

  it('ignores legacy aggregate fingerprint values', () => {
    expect(
      parseStoredSiteAlertBannerCollapse(
        '{"collapsed":true,"fingerprint":"active-alerts"}'
      )
    ).toBeNull();
  });

  it('ignores stored payloads when an alert entry is malformed', () => {
    expect(
      parseStoredSiteAlertBannerCollapse(
        '{"collapsed":true,"alerts":[{"id":"a","contentFingerprint":"x"},0]}'
      )
    ).toBeNull();
  });
});

describe('buildSiteAlertBannerCollapseAlerts', () => {
  it('builds fingerprints from stable alert fields', () => {
    expect(
      buildSiteAlertBannerCollapseAlerts([
        {
          bodyPlainText: 'Launch delayed',
          dateIso: '2026-05-08',
          dateLabel: 'May 8',
          id: 'alert-1',
        },
      ])
    ).toEqual([
      {
        id: 'alert-1',
        contentFingerprint: JSON.stringify({
          bodyPlainText: 'Launch delayed',
          dateIso: '2026-05-08',
        }),
      },
    ]);
  });
});
