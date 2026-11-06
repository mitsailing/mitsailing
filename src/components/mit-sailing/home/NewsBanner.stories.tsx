import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { NewsBanner } from '@/components/mit-sailing/site/NewsBanner';
import { buildNewsBannerCollapseAlerts } from '@/libs/mit-sailing/newsBannerCollapse';
import type { NewsBannerRow } from '@/libs/mit-sailing/newsTypes';

const rows: NewsBannerRow[] = [
  {
    id: '1',
    dateIso: '2026-04-14',
    dateLabel: 'Apr 14, 2026',
    bodyHtml:
      '<p>Limited boats available April 18 due to Boston Dinghy Cup across two lines</p>',
    bodyPlainText:
      'Limited boats available April 18 due to Boston Dinghy Cup across two lines',
  },
  {
    id: '2',
    dateIso: '2026-04-13',
    dateLabel: 'Apr 13, 2026',
    bodyHtml: '<p>Priority queue for 2026 is now open</p>',
    bodyPlainText: 'Priority queue for 2026 is now open',
  },
  {
    id: '3',
    dateIso: '2026-01-28',
    dateLabel: 'Jan 28, 2026',
    bodyHtml: '<p>Pavilion front parking unavailable until July</p>',
    bodyPlainText: 'Pavilion front parking unavailable until July',
  },
];

const meta = {
  title: 'Marketing/NewsBanner',
  component: NewsBanner,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Home news strip: one link to /news; collapse applies until reload or client navigation.',
      },
    },
  },
} satisfies Meta<typeof NewsBanner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    collapseAlerts: buildNewsBannerCollapseAlerts(rows),
    rows,
  },
};

export const SingleItem: Story = {
  args: {
    collapseAlerts: buildNewsBannerCollapseAlerts(rows.slice(0, 1)),
    rows: rows.slice(0, 1),
  },
};

export const Empty: Story = {
  args: {
    collapseAlerts: buildNewsBannerCollapseAlerts([]),
    rows: [],
  },
};
