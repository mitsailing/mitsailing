import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Vertical rhythm for marketing pages below {@link SiteSectionShell} breadcrumbs. */
type SiteSectionMainVariant = 'catalog' | 'detail';

/** Max width aligns with breadcrumbs (`max-w-7xl`) or typical catalog columns (`max-w-5xl`). */
type SiteSectionMainMaxWidth = '5xl' | '7xl';

type SiteSectionMainProps = {
  children: ReactNode;
  /** Catalog grids vs long-form articles. Defaults to catalog. */
  variant?: SiteSectionMainVariant;
  /** Cap line length / match admin tables to full header width when needed. Defaults to `5xl`. */
  maxWidth?: SiteSectionMainMaxWidth;
  className?: string;
};

const variantPadding: Record<SiteSectionMainVariant, string> = {
  catalog: 'py-12 md:py-16',
  detail: 'py-16 md:py-24',
};

const maxWidthClass: Record<SiteSectionMainMaxWidth, string> = {
  '5xl': 'max-w-5xl',
  '7xl': 'max-w-7xl',
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
