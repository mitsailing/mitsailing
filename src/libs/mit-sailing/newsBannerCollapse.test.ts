import { describe, expect, it } from 'vitest';
import {
  buildNewsBannerCollapseAlerts,
  parseStoredNewsBannerCollapse,
  serializeNewsBannerCollapse,
  newsBannerStartsCollapsed,
} from '@/libs/mit-sailing/newsBannerCollapse';
import type { NewsBannerCollapseAlert } from '@/libs/mit-sailing/newsBannerCollapse';

const activeAlerts: NewsBannerCollapseAlert[] = [
  {
    id: 'news-1',
    contentFingerprint: 'news-1-content',
  },
  {
    id: 'news-2',
    contentFingerprint: 'news-2-content',
  },
];

describe('newsBannerStartsCollapsed', () => {
  it('preserves collapsed state for same alerts', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: activeAlerts,
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(true);
  });

  it('preserves collapsed state after alert removal', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: activeAlerts.slice(0, 1),
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(true);
  });

  it('expands for new alert', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: [
          ...activeAlerts,
          {
            id: 'news-3',
            contentFingerprint: 'news-3-content',
          },
        ],
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(false);
  });

  it('expands for edited alert text', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: [
          {
            id: 'news-1',
            contentFingerprint: 'news-1-updated-text',
          },
        ],
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(false);
  });

  it('expands for edited alert date', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: [
          {
            id: 'news-1',
            contentFingerprint: 'news-1-updated-date',
          },
        ],
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(false);
  });

  it('starts collapsed when storage is empty', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: activeAlerts,
        stored: null,
      })
    ).toBe(true);
  });

  it('stays expanded when storage records an expanded banner', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: activeAlerts,
        stored: { alerts: activeAlerts, collapsed: false },
      })
    ).toBe(false);
  });

  it('does not treat empty current alerts as collapsed', () => {
    expect(
      newsBannerStartsCollapsed({
        currentAlerts: [],
        stored: { alerts: activeAlerts, collapsed: true },
      })
    ).toBe(false);
  });
});

describe('parseStoredNewsBannerCollapse', () => {
  it('reads serialized collapse alerts', () => {
    expect(
      parseStoredNewsBannerCollapse(serializeNewsBannerCollapse(activeAlerts))
    ).toEqual({ alerts: activeAlerts, collapsed: true });
  });

  it('ignores invalid storage values', () => {
    expect(parseStoredNewsBannerCollapse(null)).toBeNull();
    expect(parseStoredNewsBannerCollapse('{')).toBeNull();
    expect(parseStoredNewsBannerCollapse('0')).toBeNull();
    expect(parseStoredNewsBannerCollapse('{"collapsed":false}')).toBeNull();
  });

  it('ignores legacy aggregate fingerprint values', () => {
    expect(
      parseStoredNewsBannerCollapse(
        '{"collapsed":true,"fingerprint":"active-news"}'
      )
    ).toBeNull();
  });

  it('ignores stored payloads when an alert entry is malformed', () => {
    expect(
      parseStoredNewsBannerCollapse(
        '{"collapsed":true,"alerts":[{"id":"a","contentFingerprint":"x"},0]}'
      )
    ).toBeNull();
  });
});

describe('buildNewsBannerCollapseAlerts', () => {
  it('builds fingerprints from stable alert fields', () => {
    expect(
      buildNewsBannerCollapseAlerts([
        {
          bodyPlainText: 'Launch delayed',
          dateIso: '2026-05-08',
          dateLabel: 'May 8',
          id: 'news-1',
        },
      ])
    ).toEqual([
      {
        id: 'news-1',
        contentFingerprint: JSON.stringify({
          bodyPlainText: 'Launch delayed',
          dateIso: '2026-05-08',
        }),
      },
    ]);
  });
});
