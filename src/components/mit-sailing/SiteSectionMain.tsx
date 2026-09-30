import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Vertical rhythm for marketing pages below {@link SiteSectionShell} breadcrumbs. */
type SiteSectionMainVariant = 'admin' | 'catalog' | 'detail' | 'compactDetail';

/** Max width aligns with breadcrumbs, catalog columns, or admin workspaces. */
type SiteSectionMainMaxWidth = '5xl' | '7xl' | 'admin';

type SiteSectionMainProps = {
  children: ReactNode;
  /** Catalog grids vs long-form articles. Defaults to catalog. */
  variant?: SiteSectionMainVariant;
  /** Cap line length / match admin tables to full header width when needed. Defaults to `5xl`. */
  maxWidth?: SiteSectionMainMaxWidth;
  className?: string;
};

const variantPadding: Record<SiteSectionMainVariant, string> = {
  admin: 'py-4 md:py-6',
  catalog: 'py-12 md:py-16',
  compactDetail: 'pt-6 pb-16 md:pt-8 md:pb-24',
  detail: 'py-16 md:py-24',
};

const maxWidthClass: Record<SiteSectionMainMaxWidth, string> = {
  '5xl': 'max-w-5xl',
  '7xl': 'max-w-7xl',
  admin: 'max-w-[112rem]',
};

/**
 * Constrained content column below the section breadcrumb bar: consistent horizontal gutters
 * and Tailwind spacing scale (see Tailwind spacing docs). Compose inside `layout.tsx` /
 * `page.tsx` alongside {@link SiteSectionShell}; keeps view components focused on markup, not chrome.
 *
 * @param props - Wrapper props
 * @param props.children - Section body
 * @returns Centered constrained main region
 */
export function SiteSectionMain(props: SiteSectionMainProps) {
  const variant = props.variant ?? 'catalog';
  return (
    <div
      className={cn(
        'mx-auto w-full px-6',
        maxWidthClass[props.maxWidth ?? '5xl'],
        variantPadding[variant],
        props.className
      )}
    >
      {props.children}
    </div>
  );
}
