import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

/** One segment after Home in {@link SiteSectionShell} `segments`. Omit `href` on the last item. */
export type SiteSectionBreadcrumbSegment = {
  label: string;
  href?: string;
};

const breadcrumbLinkClassName = [
  'font-semibold text-mit-red no-underline hover:underline dark:text-mit-red-ink',
  textFocusRingClassName,
].join(' ');

export type SiteSectionBreadcrumbsProps = {
  /** Resolved `crumb_aria` (or equivalent) for the nav landmark. */
  ariaLabel: string;
  /** Full trail including Home as the first item with `href: '/'`. */
  crumbs: { label: string; href?: string }[];
};

/**
 * Breadcrumb row for section pages (shared between {@link SiteSectionShell} and Storybook).
 *
 * @param props - Breadcrumb props
 * @returns Nav with ordered list
 */
export function SiteSectionBreadcrumbs(props: SiteSectionBreadcrumbsProps) {
  const { ariaLabel, crumbs } = props;
  return (
    <nav
      aria-label={ariaLabel}
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
  );
}
