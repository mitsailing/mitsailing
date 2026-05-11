import { Check } from 'lucide-react';
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
  className: string;
  href: string | null;
  label: string | undefined;
}) {
  if (!props.href || !props.label) {
    return null;
  }
  if (isAppRelativeCmsHref(props.href)) {
    return (
      <Link className={props.className} href={props.href}>
        {props.label}
      </Link>
    );
  }
  return (
    <a
      className={props.className}
      href={props.href}
      {...externalCmsLinkProps(props.href)}
    >
      {props.label}
    </a>
  );
}

function CmsPricingCard(props: { plan: CmsPricingData['plans'][number] }) {
  const href = safeCmsHref(props.plan.linkUrl);
  const linkClassName = props.plan.highlighted
    ? 'w-full rounded-lg border-2 border-transparent bg-mit-red py-2.5 text-center text-sm font-medium text-white no-underline hover:bg-mit-red-hover'
    : 'w-full rounded-lg border border-border bg-card py-2.5 text-center text-sm font-medium text-card-foreground no-underline hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring';

  return (
    <div
      className={
        props.plan.highlighted
          ? 'relative flex flex-col rounded-xl border-2 border-primary bg-card p-8 shadow-xl shadow-primary/15 transition-all hover:-translate-y-1'
          : 'relative flex flex-col rounded-xl border border-transparent bg-mit-surface p-8 transition-all hover:-translate-y-1'
      }
    >
      {props.plan.highlighted && props.plan.badge ? (
        <span
          className="absolute -top-3 left-8 rounded-full bg-mit-red px-3 py-1 text-xs font-bold tracking-wider text-white"
          style={{ textTransform: 'uppercase' }}
        >
          {props.plan.badge}
        </span>
      ) : null}
      <div className="mb-8">
        <h3 className="mb-1 text-lg font-bold text-mit-text">
          {props.plan.title}
        </h3>
        {props.plan.description ? (
          <p className="text-xs text-mit-text">{props.plan.description}</p>
        ) : null}
      </div>
      <div className="mb-8 flex items-baseline gap-1">
        <span className="font-mit-serif text-[32px] font-bold text-mit-text">
          {props.plan.price}
        </span>
        {props.plan.frequency ? (
          <span className="text-xs text-mit-text">{props.plan.frequency}</span>
        ) : null}
      </div>
      <ul className="mb-8 flex-1 space-y-4 text-xs text-mit-text">
        {keyedStringItems(props.plan.features).map((entry) => (
          <li className="flex items-start gap-3" key={entry.key}>
            <Check className="mt-0.5 shrink-0 text-mit-success" size={16} />
            <span className="leading-snug">{entry.value}</span>
          </li>
        ))}
      </ul>
      <CmsPricingPlanLink
        className={linkClassName}
        href={href}
        label={props.plan.linkLabel}
      />
    </div>
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
    <section className="border-b border-border bg-background py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <h2 className="mb-3 font-mit-serif text-[22px] font-semibold text-foreground">
              {props.block.title}
            </h2>
            {props.block.subtitle ? (
              <p className="text-base text-muted-foreground">
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
        {pricing.footnote ? (
          <p className="mt-12 text-center text-xs text-mit-text">
            {pricing.footnote}
          </p>
        ) : null}
      </div>
    </section>
  );
}
