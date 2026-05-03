import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AdminStatusPill } from './AdminStatusPill';
import type {
  AdminStatusPillDensity,
  AdminStatusPillTone,
} from './AdminStatusPill';

const TONES = [
  'success',
  'neutral',
  'danger',
] as const satisfies readonly AdminStatusPillTone[];
const DENSITIES = [
  'compact',
  'comfortable',
] as const satisfies readonly AdminStatusPillDensity[];

const meta = {
  title: 'Admin/StatusPill',
  component: AdminStatusPill,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
  },
  args: {
    children: 'Live',
    tone: 'success',
    density: 'compact',
  },
  argTypes: {
    tone: {
      control: 'select',
      options: [...TONES],
      description:
        'Semantic background and text (matches catalog Live/Draft and booleans).',
    },
    density: {
      control: 'select',
      options: [...DENSITIES],
      description:
        'Table cells use compact; edit heading badges use comfortable.',
    },
  },
} satisfies Meta<typeof AdminStatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Draft: Story = {
  args: { children: 'Draft', tone: 'neutral' },
};

export const BannedYes: Story = {
  args: { children: 'Yes', tone: 'danger' },
};

export const ComfortableLive: Story = {
  args: { children: 'Live', tone: 'success', density: 'comfortable' },
};

/**
 * Side-by-side comparison of all tones at compact density (default list styling).
 */
export const ToneGridCompact: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 bg-white p-6">
      <AdminStatusPill tone="success">Live</AdminStatusPill>
      <AdminStatusPill tone="neutral">Draft</AdminStatusPill>
      <AdminStatusPill tone="danger">Yes</AdminStatusPill>
      <AdminStatusPill tone="success">Yes</AdminStatusPill>
      <AdminStatusPill tone="neutral">No</AdminStatusPill>
    </div>
  ),
  parameters: { layout: 'fullscreen' },
};
