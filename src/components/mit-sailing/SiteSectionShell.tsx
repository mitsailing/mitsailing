import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { SiteSectionBreadcrumbs } from '@/components/mit-sailing/SiteSectionBreadcrumbs';
import type { SiteSectionBreadcrumbSegment } from '@/components/mit-sailing/SiteSectionBreadcrumbs';

type SiteSectionShellProps = {
  children: ReactNode;
  locale: string;
  segments: SiteSectionBreadcrumbSegment[];
};

/**
 * Public site section shell: full-width breadcrumb bar (mit-redesign BreadcrumbLayout
 * parity) + main content.
 *
 * @param props - Layout props
 * @param props.children - Page content below the breadcrumb
 * @param props.locale - Active locale
 * @param props.segments - Trail after Home; last item is the current page
 * @returns Breadcrumb bar and children
 */
export async function SiteSectionShell(props: SiteSectionShellProps) {
  setRequestLocale(props.locale);
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingRoutes',
  });

  const crumbs: { label: string; href?: string }[] = [
    { label: t('crumb_home'), href: '/' },
    ...props.segments.map((s, i) => {
      const isLast = i === props.segments.length - 1;
      if (isLast) {
        return { label: s.label };
      }
      return { label: s.label, href: s.href };
    }),
  ];

  return (
    <div className="min-h-0 min-w-0 flex-1">
      <SiteSectionBreadcrumbs ariaLabel={t('crumb_aria')} crumbs={crumbs} />
      {props.children}
    </div>
  );
}
