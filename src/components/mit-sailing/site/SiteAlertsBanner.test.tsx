import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SiteAlertsBanner } from '@/components/mit-sailing/site/SiteAlertsBanner';
import { resetSiteAlertBannerCollapseStateForTests } from '@/components/mit-sailing/site/useSiteAlertBannerCollapsed';
import { buildSiteAlertBannerCollapseAlerts } from '@/libs/mit-sailing/siteAlertBannerCollapse';
import type { SiteAlertBannerRow } from '@/libs/mit-sailing/siteAlertTypes';
import enMessages from '@/locales/en.json';

const mitSite = enMessages.MitSailingSite;

const firstRow: SiteAlertBannerRow = {
  bodyPlainText: 'Limited boats available April 18.',
  dateIso: '2026-04-14',
  dateLabel: 'Apr 14, 2026',
  id: 'alert-1',
};

const rows: SiteAlertBannerRow[] = [
  firstRow,
  {
    bodyPlainText: 'Priority queue for 2026 is now open.',
    dateIso: '2026-04-13',
    dateLabel: 'Apr 13, 2026',
    id: 'alert-2',
  },
];

const collapseAlerts = buildSiteAlertBannerCollapseAlerts(rows);

describe('SiteAlertsBanner', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => {
          store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
          return store.size;
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
        setItem: (key: string, value: string) => {
          store.set(key, String(value));
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    resetSiteAlertBannerCollapseStateForTests();
    vi.restoreAllMocks();
  });

  it('renders a collapsed summary and disclosure controls by default', () => {
    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.alerts_banner_heading })
    ).toBeVisible();
    expect(
      screen.getByRole('link', {
        name: /2 alerts/u,
      })
    ).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: mitSite.alerts_toggle_expand_aria,
      })
    ).toBeVisible();
  });

  it('returns null when there are no rows', () => {
    render(<SiteAlertsBanner collapseAlerts={[]} rows={[]} />);

    expect(
      screen.queryByRole('heading', { name: mitSite.alerts_banner_heading })
    ).not.toBeInTheDocument();
  });

  it('still toggles expand when persisting to localStorage throws', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    await user.click(
      screen.getByRole('button', {
        name: mitSite.alerts_toggle_expand_aria,
      })
    );

    expect(screen.getByText(firstRow.bodyPlainText)).toBeVisible();
  });

  it('survives localStorage.getItem throwing during hydration', () => {
    window.localStorage.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.alerts_banner_heading })
    ).toBeVisible();
  });
});
