import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MitnaSubNavColumn } from '@/components/mit-sailing/MitnaSubNavColumn';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';

const meta = {
  title: 'Marketing/SiteSidebarLayout',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function PlaceholderRail() {
  return (
    <aside className="rounded-lg border border-mit-line bg-mit-surface/60 p-3 text-sm text-mit-text">
      <p className="m-0 font-semibold">Sidebar</p>
      <p className="mt-2 mb-0 text-muted-foreground">
        Swap this slot for admin nav, filters, or a section TOC.
      </p>
    </aside>
  );
}

function StretchRail() {
  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-mit-line bg-card px-3 py-3">
      <nav aria-label="Example" className="flex flex-col gap-1">
        <span className="rounded-md bg-mit-surface px-2 py-1.5 text-sm font-semibold text-mit-red dark:text-mit-red-ink">
          Active
        </span>
        <span className="rounded-md px-2 py-1.5 text-sm font-medium text-mit-text">
          Link two
        </span>
      </nav>
      <div className="mt-auto border-t border-mit-line pt-2 text-xs text-mit-text">
        Pinned to bottom when stretch is on.
      </div>
    </div>
  );
}

function SampleMain(props: { tall?: boolean }) {
  return (
    <article className="min-w-0 text-mit-text">
      <h1 className="font-mit-serif text-2xl font-semibold tracking-tight">
        Main column
      </h1>
      <p className="mt-2 text-sm leading-6">
        Uses{' '}
        <code className="text-mit-red dark:text-mit-red-ink">
          minmax(0,1fr)
        </code>{' '}
        so long prose and wide tables stay inside the grid without forcing
        horizontal page scroll.
      </p>
      {props.tall ? (
        <div className="mt-6 space-y-3 text-sm leading-6">
          {Array.from({ length: 12 }, (_, i) => (
            <p key={i} className="m-0">
              Paragraph {i + 1}. Lorem ipsum dolor sit amet, consectetur
              adipiscing elit. Sed do eiusmod tempor incididunt ut labore et
              dolore magna aliqua.
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

const chrome =
  'mx-auto max-w-7xl rounded-lg border border-mit-line bg-card p-6';

/** Wider rail + smaller gaps — same preset as marketing `/admin`. */
export const ComfortableStretch: Story = {
  render: () => (
    <div className={chrome}>
      <SiteSidebarLayout stretch sidebar={<StretchRail />}>
        <SampleMain tall />
      </SiteSidebarLayout>
    </div>
  ),
};

/** Default density without stretch (sidebar height follows its content). */
export const ComfortableStatic: Story = {
  render: () => (
    <div className={chrome}>
      <SiteSidebarLayout sidebar={<PlaceholderRail />}>
        <SampleMain />
      </SiteSidebarLayout>
    </div>
  ),
};

/** Same grid as `/about/mitna` — compact rail with leading (back) above mobile menu. */
export const CompactMitnaNav: Story = {
  render: () => (
    <div className={chrome}>
      <SiteSidebarLayout
        density="compact"
        leading={
          <span className="text-sm font-semibold text-mit-red dark:text-mit-red-ink">
            ← Back (leading slot)
          </span>
        }
        sidebar={<MitnaSubNavColumn />}
      >
        <SampleMain />
      </SiteSidebarLayout>
    </div>
  ),
};
