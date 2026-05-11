'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';
import { usePathname } from '@/libs/I18nNavigation';

type SiteSidebarMobileNavProps = {
  children: ReactNode;
  /** When true, desktop rail matches main column height (see {@link SiteSidebarLayout}). */
  stretch: boolean;
  /** Optional override; defaults to `SiteSidebarLayout.mobile_menu_label`. */
  mobileNavLabel?: ReactNode;
};

/**
 * Renders the sidebar twice: a compact disclosure on small viewports and the
 * full rail from `md` up. Only one branch is visible to users and assistive
 * tech at a time (`hidden` / `md:hidden`).
 *
 * @param props - Rail props
 * @param props.children - Sidebar body (nav, filters, etc.)
 * @returns Mobile disclosure + desktop column wrapper
 */
export function SiteSidebarMobileNav(props: SiteSidebarMobileNavProps) {
  const pathname = usePathname();
  const t = useTranslations('SiteSidebarLayout');
  const label = props.mobileNavLabel ?? t('mobile_menu_label');

  const summaryClass = cn(
    'flex w-full cursor-pointer list-none items-center justify-between gap-3 rounded-lg border border-mit-line bg-card px-4 py-3 text-left text-sm font-semibold text-mit-text no-underline',
    'min-h-11 shadow-sm',
    '[&::-webkit-details-marker]:hidden',
    textFocusRingClassName
  );

  return (
    <>
      <div className="md:hidden">
        <details
          key={pathname}
          className="group rounded-lg border border-transparent bg-transparent"
        >
          <summary className={summaryClass}>
            <span className="min-w-0 truncate">{label}</span>
            <ChevronDown
              aria-hidden
              className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180"
              strokeWidth={2}
            />
          </summary>
          <div className="mt-2 rounded-lg border border-mit-line bg-card p-2 shadow-sm">
            {props.children}
          </div>
        </details>
      </div>
      <div
        className={cn(
          'hidden min-h-0',
          props.stretch
            ? 'md:flex md:w-max md:flex-col md:min-h-full'
            : 'md:block'
        )}
      >
        {props.children}
      </div>
    </>
  );
}
