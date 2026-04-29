import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MitnaSubNavColumn } from '@/components/mit-sailing/MitnaSubNavColumn';

const meta = {
  title: 'Marketing/MitNA',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Two-column MITNA shell (sidebar + body) matching prod layout widths. */
export const SubNavAndContent: Story = {
  render: () => (
    <div className="mx-auto max-w-7xl rounded-lg border border-mit-line bg-white p-6">
      <div className="grid gap-8 md:grid-cols-[minmax(0,14rem)_1fr]">
        <MitnaSubNavColumn />
        <div className="min-w-0 text-mit-text">
          <h1 className="font-mit-serif text-2xl font-semibold">Overview</h1>
          <p className="mt-2 text-sm">
            Main column placeholder — real content comes from app routes.
          </p>
        </div>
      </div>
    </div>
  ),
};
