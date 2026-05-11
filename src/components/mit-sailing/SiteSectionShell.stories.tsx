import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SiteSectionBreadcrumbs } from '@/components/mit-sailing/SiteSectionBreadcrumbs';

const meta = {
  title: 'Marketing/SectionShell',
  component: SiteSectionBreadcrumbs,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof SiteSectionBreadcrumbs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Section hub: Home / About (current). */
export const Hub: Story = {
  args: {
    ariaLabel: 'Breadcrumb',
    crumbs: [{ label: 'Home', href: '/' }, { label: 'About' }],
  },
};

/** Detail page: Home / About / Staff name (current). */
export const Detail: Story = {
  args: {
    ariaLabel: 'Breadcrumb',
    crumbs: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Hannah Agate' },
    ],
  },
};
