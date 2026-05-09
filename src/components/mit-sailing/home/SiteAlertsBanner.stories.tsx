import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SiteAlertsBanner } from '@/components/mit-sailing/site/SiteAlertsBanner';
import { buildSiteAlertBannerCollapseAlerts } from '@/libs/mit-sailing/siteAlertBannerCollapse';
import type { SiteAlertBannerRow } from '@/libs/mit-sailing/siteAlertTypes';

const rows: SiteAlertBannerRow[] = [
  {
    id: '1',
    dateIso: '2026-04-14',
    dateLabel: 'Apr 14, 2026',
    bodyPlainText:
      'Limited boats available April 18 due to Boston Dinghy Cup across two lines',
  },
  {
    id: '2',
    dateIso: '2026-04-13',
    dateLabel: 'Apr 13, 2026',
    bodyPlainText: 'Priority queue for 2026 is now open',
  },
  {
    id: '3',
    dateIso: '2026-01-28',
    dateLabel: 'Jan 28, 2026',
    bodyPlainText: 'Pavilion front parking unavailable until July',
  },
];

const meta = {
  title: 'Marketing/SiteAlertsBanner',
  component: SiteAlertsBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Home alerts strip: expanded on load; collapse applies until reload or client navigation. Expanded link uses a short accessible name.',
      },
    },
  },
} satisfies Meta<typeof SiteAlertsBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    collapseAlerts: buildSiteAlertBannerCollapseAlerts(rows),
    rows,
  },
};

export const SingleAlert: Story = {
  args: {
    collapseAlerts: buildSiteAlertBannerCollapseAlerts(rows.slice(0, 1)),
    rows: rows.slice(0, 1),
  },
};

export const Empty: Story = {
  args: {
    collapseAlerts: buildSiteAlertBannerCollapseAlerts([]),
    rows: [],
  },
};
