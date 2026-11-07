'use client';

import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useRef, useState } from 'react';
import { CmsRichText } from '@/components/mit-sailing/cms/CmsRichText';
import { Link } from '@/libs/I18nNavigation';
import { setNewsBannerCollapsed } from '@/libs/mit-sailing/newsBannerCollapseAction';
import type { NewsBannerRow } from '@/libs/mit-sailing/newsTypes';

const linkClass =
  'block min-h-11 text-inherit no-underline outline-offset-[3px] focus-visible:relative focus-visible:z-[1] focus-visible:ring-2 focus-visible:ring-ring';

function NewsBannerCollapsedSummary(props: {
  collapsedCountLabel: string;
  seeAllLabel: string;
}) {
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 px-5 py-2.5 sm:px-6">
      <span className="text-[clamp(0.8125rem,2.8vw,0.9375rem)] text-foreground">
        {props.collapsedCountLabel}
      </span>
      <span className="text-sm font-semibold text-foreground underline underline-offset-[3px]">
        {props.seeAllLabel}
      </span>
      <span aria-hidden className="text-base leading-none">
        ›
      </span>
    </div>
  );
}

function NewsBannerExpandedList(props: {
  headingId: string;
  rows: NewsBannerRow[];
  viewAllLabel: string;
}) {
  return (
    <div className="flex min-h-11 flex-col justify-center gap-0 px-5 py-3 sm:px-6">
      <ul
        aria-labelledby={props.headingId}
        className="flex flex-col gap-2.5 p-0 [list-style:none]"
      >
        {props.rows.map((row) => (
          <li className="m-0" key={row.id}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[clamp(0.8125rem,2.8vw,0.9375rem)] leading-snug">
              <time
                className="shrink-0 font-semibold text-foreground tabular-nums"
                dateTime={row.dateIso}
              >
                {row.dateLabel}
              </time>
              <CmsRichText
                className="news-banner-body min-w-0 flex-1 [overflow-wrap:anywhere] hyphens-auto [&_p]:m-0 [&_p+p]:mt-1.5"
                sanitizedHtml={row.bodyHtml}
              />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-1 text-start text-sm font-semibold text-foreground underline decoration-transparent underline-offset-[3px]">
        <span>{props.viewAllLabel}</span>
        <span aria-hidden className="text-base leading-none">
          ›
        </span>
      </div>
    </div>
  );
}

function NewsBannerLink(props: {
  collapsed: boolean;
  collapsedCountLabel: string;
  headingId: string;
  linkAriaLabel: string;
  rows: NewsBannerRow[];
  seeAllLabel: string;
  viewAllLabel: string;
}) {
  return (
    <Link aria-label={props.linkAriaLabel} className={linkClass} href="/news">
      {props.collapsed ? (
        <NewsBannerCollapsedSummary
          collapsedCountLabel={props.collapsedCountLabel}
          seeAllLabel={props.seeAllLabel}
        />
      ) : (
        <NewsBannerExpandedList
          headingId={props.headingId}
          rows={props.rows}
          viewAllLabel={props.viewAllLabel}
        />
      )}
    </Link>
  );
}

function NewsBannerToggle(props: {
  collapsed: boolean;
  disclosureId: string;
  onToggle: () => void;
  showLessLabel: string;
  showMoreLabel: string;
  toggleAriaLabel: string;
}) {
  return (
    <button
      aria-controls={props.disclosureId}
      aria-expanded={!props.collapsed}
      aria-label={props.toggleAriaLabel}
      className="flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border border-transparent px-3 py-1.5 text-xs leading-tight font-semibold text-foreground! transition-colors hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:min-w-[4.5rem]"
      data-expanded={(!props.collapsed).toString()}
      type="button"
      onClick={props.onToggle}
    >
      <span
        aria-hidden
        className={`flex items-center justify-center text-foreground transition-transform duration-200 ease-out ${props.collapsed ? '' : 'rotate-180'}`}
      >
        <ChevronDown aria-hidden className="size-[1.125rem]" strokeWidth={2} />
      </span>
      <span aria-hidden className="leading-tight text-foreground!">
        {props.collapsed ? props.showMoreLabel : props.showLessLabel}
      </span>
    </button>
  );
}

function NewsBannerBar(props: {
  collapsed: boolean;
  collapsedCountLabel: string;
  disclosureId: string;
  headingId: string;
  headingLabel: string;
  linkAriaLabel: string;
  onToggle: () => void;
  rows: NewsBannerRow[];
  seeAllLabel: string;
  showLessLabel: string;
  showMoreLabel: string;
  toggleAriaLabel: string;
  viewAllLabel: string;
}) {
  return (
    <section
      aria-labelledby={props.headingId}
      className="bg-muted text-foreground"
      data-news-banner
    >
      <h2 className="sr-only" id={props.headingId}>
        {props.headingLabel}
      </h2>
      <div className="mx-auto flex max-w-7xl items-stretch">
        <div className="min-w-0 flex-1" id={props.disclosureId}>
          <NewsBannerLink
            collapsed={props.collapsed}
            collapsedCountLabel={props.collapsedCountLabel}
            headingId={props.headingId}
            linkAriaLabel={props.linkAriaLabel}
            rows={props.rows}
            seeAllLabel={props.seeAllLabel}
            viewAllLabel={props.viewAllLabel}
          />
        </div>
        <NewsBannerToggle
          collapsed={props.collapsed}
          disclosureId={props.disclosureId}
          showLessLabel={props.showLessLabel}
          showMoreLabel={props.showMoreLabel}
          toggleAriaLabel={props.toggleAriaLabel}
          onToggle={props.onToggle}
        />
      </div>
    </section>
  );
}

/**
 * Site strip listing active banner news (collapsible).
 * The message area is one link to `/news`; body anchors are unwrapped server-side.
 *
 * @param props - Banner rows already filtered for the visibility window
 * @returns Banner markup or `null` when there are no rows
 */
export function NewsBanner(props: {
  collapsed: boolean;
  rows: NewsBannerRow[];
  signature: string;
}) {
  const t = useTranslations('MitSailingSite');
  const disclosureId = useId();
  const headingId = `${disclosureId}-heading`;
  const [choice, setChoice] = useState<{
    collapsed: boolean;
    signature: string;
  } | null>(null);
  const collapsed =
    choice?.signature === props.signature ? choice.collapsed : props.collapsed;
  const saving = useRef(false);

  async function toggleCollapsed() {
    if (saving.current) {
      return;
    }
    saving.current = true;
    const next = !collapsed;
    setChoice({ collapsed: next, signature: props.signature });
    try {
      await setNewsBannerCollapsed(next ? props.signature : null);
    } catch {
      setChoice(null);
    } finally {
      saving.current = false;
    }
  }

  if (props.rows.length === 0) {
    return null;
  }

  const total = props.rows.length;
  const collapsedCountLabel =
    total === 1
      ? t('news_collapsed_count_one')
      : t('news_collapsed_count_many', { count: total });

  return (
    <NewsBannerBar
      collapsed={collapsed}
      collapsedCountLabel={collapsedCountLabel}
      disclosureId={disclosureId}
      headingId={headingId}
      headingLabel={t('news_banner_heading')}
      linkAriaLabel={
        collapsed
          ? `${t('news_banner_aria_prefix')}: ${collapsedCountLabel} ${t('news_see_all')}.`
          : t('news_banner_link_expanded_aria')
      }
      rows={props.rows}
      seeAllLabel={t('news_see_all')}
      showLessLabel={t('news_show_less')}
      showMoreLabel={t('news_show_more')}
      toggleAriaLabel={
        collapsed
          ? t('news_toggle_expand_aria')
          : t('news_toggle_collapse_aria')
      }
      viewAllLabel={t('news_view_all')}
      onToggle={toggleCollapsed}
    />
  );
}
