import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MitnaSubNavLayout } from '@/components/mit-sailing/MitnaSubNavLayout';

const meta = {
  title: 'Marketing/MitNA',
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Production MITNA shell: {@link MitnaSubNavLayout} + localized subnav column. */
export const SubNavAndContent: Story = {
  render: () => (
    <div className="mx-auto max-w-7xl rounded-lg border border-mit-line bg-white p-6">
      <MitnaSubNavLayout
        leading={
          <span className="text-sm font-semibold text-mit-red">
            ← Back to About
          </span>
        }
      >
        <div className="min-w-0 text-mit-text">
          <h1 className="font-mit-serif text-2xl font-semibold">Overview</h1>
          <p className="mt-2 text-sm leading-6">
            Main column — same composition as{' '}
            <code className="text-mit-red">MitnaMarketingPageShell</code> routes
            under <code className="text-mit-red">/about/mitna</code>.
          </p>
        </div>
      </MitnaSubNavLayout>
    </div>
  ),
};
