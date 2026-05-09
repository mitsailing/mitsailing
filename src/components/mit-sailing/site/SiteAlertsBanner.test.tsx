import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SiteAlertsBanner } from '@/components/mit-sailing/site/SiteAlertsBanner';
import { buildSiteAlertBannerCollapseAlerts } from '@/libs/mit-sailing/siteAlertBannerCollapse';
import type { SiteAlertBannerRow } from '@/libs/mit-sailing/siteAlertTypes';

const rows: SiteAlertBannerRow[] = [
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
  it('renders active alerts and disclosure controls', () => {
    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: 'Current site alerts' })
    ).toBeVisible();
    expect(screen.getByText('Limited boats available April 18.')).toBeVisible();
    expect(
      screen.getByRole('button', {
        name: 'Collapse site alerts to a short summary',
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
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new DOMException('quota', 'QuotaExceededError');
      });

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    await user.click(
      screen.getByRole('button', {
        name: 'Collapse site alerts to a short summary',
      })
    );

    expect(
      screen.getByRole('link', {
        name: /Site alerts: 2 alerts\. See all alerts\./i,
      })
    ).toBeVisible();

    setItemSpy.mockRestore();
  });

  it('survives localStorage.getItem throwing during hydration', () => {
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });

    render(<SiteAlertsBanner collapseAlerts={collapseAlerts} rows={rows} />);

    expect(
      screen.getByRole('heading', { name: 'Current site alerts' })
    ).toBeVisible();

    getItemSpy.mockRestore();
  });
});
