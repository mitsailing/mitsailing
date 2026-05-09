import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteAlertsBanner } from '@/components/mit-sailing/site/SiteAlertsBanner';
import { buildSiteAlertBannerCollapseAlerts } from '@/libs/mit-sailing/siteAlertBannerCollapse';
import type { SiteAlertBannerRow } from '@/libs/mit-sailing/siteAlertTypes';
import enMessages from '@/locales/en.json';

const mitSite = enMessages.MitSailingSite;

/**
 * Builds the collapsed summary link `aria-label` from `MitSailingSite` messages.
 *
 * @param alertCount Number of alerts in the collapsed summary.
 * @returns Localized `aria-label` text for the collapsed summary link.
 */
function collapsedSummaryLinkAriaLabel(alertCount: number): string {
  const countLabel =
    alertCount === 1
      ? mitSite.alerts_collapsed_count_one
      : mitSite.alerts_collapsed_count_many.replaceAll(
          '{count}',
          String(alertCount)
        );
  return `${mitSite.alerts_banner_aria_prefix}: ${countLabel} ${mitSite.alerts_see_all}.`;
}

const rows: [SiteAlertBannerRow, SiteAlertBannerRow] = [
  {
    bodyPlainText: 'Limited boats available April 18.',
    dateIso: '2026-04-14',
    dateLabel: 'Apr 14, 2026',
    id: 'alert-1',
  },
  {
    bodyPlainText: 'Priority queue for 2026 is now open.',
    dateIso: '2026-04-13',
    dateLabel: 'Apr 13, 2026',
    id: 'alert-2',
  },
];

const collapseAlerts = buildSiteAlertBannerCollapseAlerts(rows);

describe('SiteAlertsBanner', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders active alerts and disclosure controls', () => {
    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.alerts_banner_heading })
    ).toBeVisible();
    expect(screen.getByText(rows[0].bodyPlainText)).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: mitSite.alerts_toggle_collapse_aria,
      })
    ).toBeVisible();
  });

  it('returns null when there are no rows', () => {
    const { container } = render(
      <SiteAlertsBanner collapseAlerts={[]} rows={[]} />
    );

    expect(container.firstChild).toBeNull();
  });

  it('still toggles collapse when persisting to localStorage throws', async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    await user.click(
      screen.getByRole('button', {
        name: mitSite.alerts_toggle_collapse_aria,
      })
    );

    expect(
      screen.getByRole('link', {
        name: collapsedSummaryLinkAriaLabel(rows.length),
      })
    ).toBeVisible();
  });

  it('survives localStorage.getItem throwing during hydration', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: mitSite.alerts_banner_heading })
    ).toBeVisible();
  });
});
