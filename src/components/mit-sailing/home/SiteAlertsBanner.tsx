'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Link } from '@/libs/I18nNavigation';
import type { SiteAlertBannerRow } from '@/libs/mit-sailing/siteAlertTypes';

const MAX_ROWS = 2;

const SITE_ALERT_BANNER_PRIMARY_LINK_CLASS =
  'block min-h-11 text-inherit no-underline outline-offset-[3px] focus-visible:relative focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Home strip listing active banner alerts (collapsible).
 * Always loads expanded; minimize state applies until the next full navigation or reload.
 * Uses {@link https://www.w3.org/WAI/ARIA/apg/patterns/disclosure-pattern/ | disclosure semantics} (`aria-expanded`, `aria-controls`).
 *
 * @param props - Banner rows already filtered for the visibility window
 * @returns Banner markup or `null` when there are no rows
 */
export function SiteAlertsBanner(props: { rows: SiteAlertBannerRow[] }) {
  const t = useTranslations('MitSailingHome');
  const disclosureId = useId();
  const headingId = `${disclosureId}-heading`;

  const [collapsed, setCollapsed] = useState(false);

  const total = props.rows.length;
  const displayRows = props.rows.slice(0, MAX_ROWS);

  function toggleCollapsed() {
    setCollapsed((c) => !c);
  }

  if (total === 0) {
    return null;
  }

  const expandedLinkAriaLabel = t('alerts_banner_link_expanded_aria');

  const collapsedCountLabel =
    total === 1
      ? t('alerts_collapsed_count_one')
      : t('alerts_collapsed_count_many', { count: total });

  const collapsedAriaLabel = `${t('alerts_banner_aria_prefix')}: ${collapsedCountLabel} ${t('alerts_see_all')}.`;

  return (
    <section
      aria-labelledby={headingId}
      className="bg-muted text-foreground"
      data-alert-banner
    >
      <h2 className="sr-only" id={headingId}>
        {t('alerts_banner_heading')}
      </h2>
      <div className="mx-auto flex max-w-7xl items-stretch">
        <div className="min-w-0 flex-1" id={disclosureId}>
          {collapsed ? (
            <Link
              aria-label={collapsedAriaLabel}
              className={SITE_ALERT_BANNER_PRIMARY_LINK_CLASS}
              href="/alerts/"
            >
              <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 px-5 py-2.5 sm:px-6">
                <span className="text-[clamp(0.8125rem,2.8vw,0.9375rem)] text-foreground">
                  {collapsedCountLabel}
                </span>
                <span className="text-sm font-semibold text-foreground underline underline-offset-[3px]">
                  {t('alerts_see_all')}
                </span>
                <span aria-hidden className="text-base leading-none">
                  ›
                </span>
              </div>
            </Link>
          ) : (
            <Link
              aria-label={expandedLinkAriaLabel}
              className={SITE_ALERT_BANNER_PRIMARY_LINK_CLASS}
              href="/alerts/"
            >
              <div className="flex min-h-11 flex-col justify-center gap-0 px-5 py-3 sm:px-6">
                <ul
                  aria-labelledby={headingId}
                  className="flex flex-col gap-2.5 p-0 [list-style:none]"
                  role="list"
                >
                  {displayRows.map((row) => (
                    <li className="m-0" key={row.id}>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[clamp(0.8125rem,2.8vw,0.9375rem)] leading-snug">
                        <time
                          className="shrink-0 font-semibold text-foreground tabular-nums"
                          dateTime={row.dateIso}
                        >
                          {row.dateLabel}
                        </time>
                        <span className="min-w-0 flex-1 [overflow-wrap:anywhere] hyphens-auto">
                          {row.bodyPlainText}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center gap-1 text-start text-sm font-semibold text-foreground underline decoration-transparent underline-offset-[3px]">
                  <span>{t('alerts_view_all')}</span>
                  <span aria-hidden className="text-base leading-none">
                    ›
                  </span>
                </div>
              </div>
            </Link>
          )}
        </div>
        <button
          aria-controls={disclosureId}
          aria-expanded={!collapsed}
          aria-label={
            collapsed
              ? t('alerts_toggle_expand_aria')
              : t('alerts_toggle_collapse_aria')
          }
          className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-3 py-1.5 text-xs leading-tight font-semibold text-foreground transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-w-[4.5rem]"
          data-expanded={(!collapsed).toString()}
          type="button"
          onClick={toggleCollapsed}
        >
          <span
            aria-hidden
            className={`flex items-center justify-center text-muted-foreground transition-transform duration-200 ease-out ${collapsed ? '' : 'rotate-180'}`}
          >
            <ChevronDown
              aria-hidden
              className="size-[1.125rem]"
              strokeWidth={2}
            />
          </span>
          <span aria-hidden className="leading-tight">
            {collapsed ? t('alerts_show_more') : t('alerts_show_less')}
          </span>
        </button>
      </div>
    </section>
  );
}
