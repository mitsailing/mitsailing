import type { ReactNode } from 'react';
import { SiteSidebarMobileNav } from '@/components/mit-sailing/SiteSidebarMobileNav';
import { cn } from '@/lib/utils';

type SiteSidebarDensity = 'comfortable' | 'compact';

type SiteSidebarLayoutProps = {
  /** Left column (navigation rail, filters, etc.). */
  sidebar: ReactNode;
  /** Main column (page body). */
  children: ReactNode;
  /**
   * Full-width block stacked before the sidebar on small screens (e.g. back
   * link). From `md` up, placed in the main column above {@link children}.
   */
  leading?: ReactNode;
  /**
   * When true, the sidebar column matches the main column height so nested
   * sidebars can use `h-full` / `mt-auto` (e.g. admin rail).
   */
  stretch?: boolean;
  /**
   * `comfortable` — wider rail + tighter gaps (admin). `compact` — MITNA-style
   * about subnav widths.
   */
  density?: SiteSidebarDensity;
  /** Mobile disclosure trigger; defaults to {@link SiteSidebarLayout} i18n. */
  mobileNavLabel?: ReactNode;
  className?: string;
};

const densityGrid: Record<SiteSidebarDensity, { grid: string }> = {
  comfortable: {
    grid: 'grid-cols-1 gap-4 md:grid-cols-[minmax(17rem,18rem)_minmax(0,1fr)] md:gap-x-6 md:gap-y-0',
  },
  compact: {
    grid: 'grid-cols-1 gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-x-8 md:gap-y-0',
  },
};

/**
 * Two-column marketing layout: fixed-width sidebar + fluid main. Keeps
 * `minmax(0,1fr)` on the main column so wide tables and prose shrink correctly.
 *
 * @param props - Layout props
 * @returns Grid with sidebar and main regions
 */
export function SiteSidebarLayout(props: SiteSidebarLayoutProps) {
  const density = props.density ?? 'comfortable';
  const { grid } = densityGrid[density];
  const stretch = Boolean(props.stretch);
  const hasLeading = props.leading !== undefined && props.leading !== null;

  return (
    <div
      className={cn(
        'grid',
        grid,
        hasLeading && 'md:grid-rows-[auto_minmax(0,1fr)] md:gap-y-6',
        stretch ? 'md:items-stretch' : 'md:items-start',
        props.className
      )}
    >
      {hasLeading ? (
        <div className="min-w-0 md:col-start-2 md:row-start-1">
          {props.leading}
        </div>
      ) : null}
      <div
        className={cn(
          'min-h-0',
          hasLeading && 'md:col-start-1 md:row-span-2 md:row-start-1',
          stretch && 'md:flex md:flex-col md:min-h-full'
        )}
      >
        <SiteSidebarMobileNav
          mobileNavLabel={props.mobileNavLabel}
          stretch={stretch}
        >
          {props.sidebar}
        </SiteSidebarMobileNav>
      </div>
      <div
        className={cn(
          'min-w-0',
          hasLeading && 'min-h-0 md:col-start-2 md:row-start-2'
        )}
      >
        {props.children}
      </div>
    </div>
  );
}
