import type { ReactNode } from 'react';
import { MitnaSubNavColumn } from '@/components/mit-sailing/MitnaSubNavColumn';

type MitnaSubNavLayoutProps = {
  children: ReactNode;
};

/**
 * Sub-navigation for the MIT North Association about section (Figma `MitnaSectionLayout`).
 * Locale is supplied by {@link SiteSectionShell} / page ancestry (`next-intl`).
 *
 * @param props - Sub-layout props
 * @param props.children - Main column content
 * @returns Localized two-column layout with a vertical nav
 */
export function MitnaSubNavLayout(props: MitnaSubNavLayoutProps) {
  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,14rem)_1fr]">
      <MitnaSubNavColumn />
      <div className="min-w-0">{props.children}</div>
    </div>
  );
}
