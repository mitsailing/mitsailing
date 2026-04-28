import { getTranslations, setRequestLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

/** One segment after "Home". Omit `href` on the last segment (current page). */
type SiteBreadcrumbSegment = {
  label: string;
  href?: string;
};

const breadcrumbLinkClassName = [
  'font-semibold text-mit-red no-underline hover:underline',
  textFocusRingClassName,
].join(' ');

type SiteSectionShellProps = {
  children: ReactNode;
  locale: string;
  segments: SiteBreadcrumbSegment[];
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
      <nav
        aria-label={t('crumb_aria')}
        className="shrink-0 border-b border-mit-line bg-mit-surface"
      >
        <div className="mx-auto max-w-7xl px-6 py-3">
          <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0 text-sm text-mit-text">
            {crumbs.map((item) => {
              const isLast = item === crumbs.at(-1);
              const hasHref = typeof item.href === 'string';
              const showLink = !isLast && hasHref;
              const linkHref = hasHref ? item.href : undefined;
              return (
                <li
                  key={`${item.label}__${linkHref ?? 'current'}`}
                  className="flex items-center gap-x-2"
                >
                  {item === crumbs[0] ? null : (
                    <span aria-hidden className="text-mit-text select-none">
                      /
                    </span>
                  )}
                  {showLink && linkHref ? (
                    <Link className={breadcrumbLinkClassName} href={linkHref}>
                      {item.label}
                    </Link>
                  ) : (
                    <span
                      className="font-medium text-mit-text"
                      style={{ fontWeight: isLast ? 600 : 500 }}
                      aria-current={isLast ? 'page' : undefined}
                    >
                      {item.label}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </nav>
      {props.children}
    </div>
  );
}
