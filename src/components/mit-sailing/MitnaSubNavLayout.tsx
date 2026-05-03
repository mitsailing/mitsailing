import type { ReactNode } from 'react';
import { MitnaSubNavColumn } from '@/components/mit-sailing/MitnaSubNavColumn';
import { SiteSidebarLayout } from '@/components/mit-sailing/SiteSidebarLayout';

type MitnaSubNavLayoutProps = {
  children: ReactNode;
  /** Optional row above the main column on desktop; first on mobile (e.g. back link). */
  leading?: ReactNode;
};

/**
 * Sub-navigation for the MIT Nautical Association about section (Figma `MitnaSectionLayout`).
 * Locale is supplied by {@link SiteSectionShell} / page ancestry (`next-intl`).
 *
 * @param props - Sub-layout props
 * @param props.children - Main column content
 * @returns Localized two-column layout with a vertical nav
 */
export function MitnaSubNavLayout(props: MitnaSubNavLayoutProps) {
  return (
    <SiteSidebarLayout
      density="compact"
      leading={props.leading}
      sidebar={<MitnaSubNavColumn />}
    >
      {props.children}
    </SiteSidebarLayout>
  );
}
