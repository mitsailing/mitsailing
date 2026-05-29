import { Check } from 'lucide-react';
import type React from 'react';
import { keyedStringItems } from '@/lib/keyedStringList';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import type { CmsPricingData } from '@/libs/mit-sailing/cmsPricing';
import {
  cmsPricingPlanTitlesUnique,
  parseCmsPricingBody,
} from '@/libs/mit-sailing/cmsPricing';
import type { PublicCmsBlock } from '@/libs/mit-sailing/cmsQueries';

function pricingGridClassName(count: number): string {
  if (count === 1) {
    return 'mx-auto grid max-w-md grid-cols-1 gap-6';
  }
  if (count === 2) {
    return 'mx-auto grid max-w-3xl grid-cols-1 gap-6 md:grid-cols-2';
  }
  if (count === 3) {
    return 'mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3';
  }
  return 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4';
}

function CmsPricingPlanLink(props: {
  href: string | null;
  label: string | undefined;
}) {
  if (!props.href || !props.label) {
    return null;
  }
  const className =
    'mt-5 block w-full rounded-md px-3 py-2 text-center text-sm/6 font-semibold text-primary-ink ring-1 ring-mit-line ring-inset hover:bg-muted/60 focus-visible:ring-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mit-red';

  if (isAppRelativeCmsHref(props.href)) {
    return (
      // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeCmsHref and isAppRelativeCmsHref restrict CMS links before rendering.
      <Link className={className} href={props.href}>
        {props.label}
      </Link>
    );
  }
  return (
    // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeCmsHref restricts CMS links to http(s) URLs before rendering.
    <a
      className={className}
      href={props.href}
      {...externalCmsLinkProps(props.href)}
    >
      {props.label}
    </a>
  );
}

function CmsPricingPriceRows(props: {
  readonly plan: CmsPricingData['plans'][number];
}) {
  if (props.plan.priceRows && props.plan.priceRows.length > 0) {
    return (
      <dl className="mb-8 grid gap-2 text-sm leading-5">
        {props.plan.priceRows.map((row) => (
          <div
            className="flex items-baseline justify-between gap-3"
            key={row.label}
          >
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="font-semibold text-mit-text tabular-nums">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div className="mb-8 flex items-baseline gap-1">
      <span className="text-2xl font-semibold tracking-normal text-mit-text">
        {props.plan.price}
      </span>
      {props.plan.frequency ? (
        <span className="text-sm text-muted-foreground">
          {props.plan.frequency}
        </span>
      ) : null}
    </div>
  );
}

function CmsPricingCard(props: { plan: CmsPricingData['plans'][number] }) {
  const href = safeCmsHref(props.plan.linkUrl);

  return (
    <div
      className={
        props.plan.highlighted
          ? 'relative flex flex-col rounded-3xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/15 transition-transform hover:-translate-y-1 motion-reduce:transform-none'
          : 'relative flex flex-col rounded-3xl border border-mit-line bg-mit-surface p-8 transition-transform hover:-translate-y-1 motion-reduce:transform-none'
      }
    >
      {props.plan.highlighted && props.plan.badge ? (
        <span className="absolute -top-3 left-8 rounded-full bg-mit-red px-3 py-1 text-xs font-bold tracking-wider text-white uppercase">
          {props.plan.badge}
        </span>
      ) : null}
      <div className="mb-8">
        <h3 className="mb-4 text-lg/8 font-semibold text-mit-text">
          {props.plan.title}
        </h3>
        {props.plan.description ? (
          <p className="text-sm/6 text-muted-foreground">
            {props.plan.description}
          </p>
        ) : null}
      </div>
      <CmsPricingPriceRows plan={props.plan} />
      <CmsPricingPlanLink href={href} label={props.plan.linkLabel} />
      <ul className="mt-8 flex-1 space-y-3 text-sm/6 text-muted-foreground">
        {keyedStringItems(props.plan.features).map((entry) => (
          <li className="flex gap-x-3" key={entry.key}>
            <Check
              aria-hidden
              className="mt-0.5 h-5 w-5 flex-none text-mit-red dark:text-mit-red-ink"
            />
            <span>{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CmsPricingFootnote(props: Readonly<{ pricing: CmsPricingData }>) {
  const href = safeCmsHref(props.pricing.footnoteLinkUrl);
  const linkClassName =
    'font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-mit-red focus-visible:ring-offset-2 focus-visible:outline-none';
  let link: React.ReactNode = null;
  if (href && props.pricing.footnoteLinkLabel) {
    link = isAppRelativeCmsHref(href) ? (
      // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeCmsHref and isAppRelativeCmsHref restrict CMS links before rendering.
      <Link className={linkClassName} href={href}>
        {props.pricing.footnoteLinkLabel}
      </Link>
    ) : (
      // nosemgrep: typescript.react.security.audit.react-href-var.react-href-var -- safeCmsHref restricts CMS links to http(s) URLs before rendering.
      <a className={linkClassName} href={href} {...externalCmsLinkProps(href)}>
        {props.pricing.footnoteLinkLabel}
      </a>
    );
  }
  if (!props.pricing.footnote && !link) {
    return null;
  }

  return (
    <p className="mt-12 text-center text-sm leading-6 text-muted-foreground">
      {props.pricing.footnote ? <span>{props.pricing.footnote}</span> : null}
      {props.pricing.footnote && link ? ' ' : null}
      {link}
    </p>
  );
}

/**
 * Renders structured CMS pricing plans, capped at four cards.
 *
 * @param props - Pricing block configuration
 * @returns Pricing block or null when the body is invalid
 */
export function CmsPricingBlock(props: {
  block: PublicCmsBlock;
  fallbackData?: CmsPricingData;
}) {
  const pricing = parseCmsPricingBody(props.block.body) ?? props.fallbackData;
  if (!pricing || !cmsPricingPlanTitlesUnique(pricing.plans)) {
    return null;
  }

  return (
    <section className="border-b border-border bg-background py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-12 max-w-4xl text-center">
          <div>
            <h2 className="mb-3 font-mit-serif text-4xl leading-tight font-bold text-mit-text">
              {props.block.title}
            </h2>
            {props.block.subtitle ? (
              <p className="mx-auto max-w-2xl text-base leading-7 text-muted-foreground">
                {props.block.subtitle}
              </p>
            ) : null}
          </div>
        </div>
        <div className={pricingGridClassName(pricing.plans.length)}>
          {pricing.plans.map((plan) => (
            <CmsPricingCard key={plan.title} plan={plan} />
          ))}
        </div>
        <CmsPricingFootnote pricing={pricing} />
      </div>
    </section>
  );
}
