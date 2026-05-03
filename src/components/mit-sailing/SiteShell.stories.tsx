'use client';

import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { SiteHeader } from '@/components/mit-sailing/site/SiteHeader';
import { WeatherConditionsBarSkeleton } from '@/components/mit-sailing/site/WeatherConditionsBar';

/**
 * Visual-only SiteShell stand-in for Storybook: conditions strip (skeleton data),
 * marketing header with empty dropdowns, main placeholder. Does not render
 * async {@link SiteFooter} — use the app for the full shell.
 *
 * @returns Stacked chrome preview tree
 */
function SiteShellStoryPreview() {
  const tMitSite = useTranslations('MitSailingSite');

  return (
    <div className="flex min-h-screen flex-col bg-white font-mit-sans text-mit-text">
      <WeatherConditionsBarSkeleton tMitSite={tMitSite} />
      <SiteHeader
        classesDropdownItems={[]}
        fleetDropdownItems={[]}
        initialShowAdminLink={false}
        initialSignedIn={false}
      />
      <div className="flex min-h-0 flex-1 flex-col" id="site-shell-inert-scope">
        <main className="flex-1 px-6 py-8 text-mit-text">
          <p className="text-sm">
            Page content placeholder. Full async chrome (live weather, DB-backed
            nav labels, SiteFooter) is only in the Next.js app.
          </p>
        </main>
        <footer
          className="mt-auto bg-mit-footer py-8 text-center text-xs text-white/70"
          aria-label="Story placeholder"
        >
          Footer omitted in Storybook — see SiteFooter in production routes.
        </footer>
      </div>
    </div>
  );
}

const meta = {
  title: 'Marketing/SiteShell',
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Drift risk: conditions copy comes from intl only; header/footer data may differ from production.',
      },
    },
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const StackedChrome: Story = {
  render: () => <SiteShellStoryPreview />,
};
