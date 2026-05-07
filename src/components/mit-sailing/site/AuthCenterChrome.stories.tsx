import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { AuthCenterBrandMark } from '@/components/mit-sailing/site/AuthCenterBrandMark';

const meta = {
  title: 'Auth/CenterChrome',
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/** Centered auth column with wordmark — mirrors `(auth)/(center)/layout`. */
export const LoginColumn: Story = {
  render: () => (
    <div className="flex min-h-screen flex-col bg-background font-mit-sans text-foreground">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <main className="w-full max-w-md space-y-6 px-4">
          <AuthCenterBrandMark />
          <p className="text-center text-sm text-mit-text">
            Sign-in form would appear below the wordmark.
          </p>
        </main>
      </div>
    </div>
  ),
};
