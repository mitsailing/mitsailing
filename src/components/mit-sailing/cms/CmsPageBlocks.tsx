import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { Link } from '@/libs/I18nNavigation';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';
import type {
  PublicCmsBlock,
  PublicCmsPage,
} from '@/libs/mit-sailing/cmsQueries';
import { CmsRichText } from './CmsRichText';

const blockInnerClassName = 'mx-auto w-full max-w-5xl px-6';

const blockLinkClassName =
  'inline-flex items-center gap-1 rounded-sm font-semibold text-mit-red-ink no-underline hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none';

function CmsBlockLink(props: {
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return null;
  }
  const className = props.className ?? blockLinkClassName;
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link className={className} href={href}>
        {props.children}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  }
  return (
    <a className={className} href={href} {...externalCmsLinkProps(href)}>
      {props.children}
      <ArrowRight aria-hidden className="size-4" />
    </a>
  );
}

function CmsHeroBlock(props: { block: PublicCmsBlock }) {
  if (props.block.imageSrc) {
    return (
      <section className="relative flex min-h-[460px] items-center overflow-hidden bg-mit-hero-ink">
        <Image
          alt={props.block.imageAlt ?? ''}
          className="object-cover object-center brightness-[1.02]"
          fill
          priority
          sizes="100vw"
          src={props.block.imageSrc}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/24 to-transparent" />
        <div className="relative z-10 mx-auto w-full max-w-7xl px-6">
          <div className="max-w-xl [text-shadow:0_1px_2px_rgba(0,0,0,0.65)]">
            {props.block.subtitle ? (
              <p className="mb-4 text-xs font-semibold tracking-widest text-white uppercase">
                {props.block.subtitle}
              </p>
            ) : null}
            <h1 className="mb-6 font-mit-serif text-4xl leading-tight font-bold text-white">
              {props.block.title}
            </h1>
            <CmsRichText
              className="mb-8 max-w-3xl text-base leading-relaxed text-white"
              html={props.block.body}
            />
            {props.block.ctaLabel && props.block.ctaUrl ? (
              <CmsBlockLink
                className="inline-flex cursor-pointer items-center justify-center rounded-lg border-2 border-white bg-transparent px-7 py-3 text-base font-medium text-white no-underline backdrop-blur transition-colors hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-mit-hero-ink focus-visible:outline-none"
                href={props.block.ctaUrl}
              >
                {props.block.ctaLabel}
              </CmsBlockLink>
            ) : null}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section className="border-b border-mit-line bg-background py-16 md:py-24">
      <div className={blockInnerClassName}>
        <h1 className="mb-6 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
          {props.block.title}
        </h1>
        <CmsRichText
          className="max-w-3xl text-base leading-relaxed text-mit-text"
          html={props.block.body}
        />
      </div>
    </section>
  );
}

function CmsTextBlock(props: { block: PublicCmsBlock; index: number }) {
  const bg = props.index % 2 === 0 ? 'bg-background' : 'bg-mit-surface';
  return (
    <section className={`border-b border-mit-line py-16 md:py-24 ${bg}`}>
      <div className={blockInnerClassName}>
        {props.block.subtitle ? (
          <p className="mb-3 text-xs font-bold tracking-widest text-primary-ink uppercase">
            {props.block.subtitle}
          </p>
        ) : null}
        <h2 className="mb-6 font-mit-serif text-2xl font-semibold text-mit-text">
          {props.block.title}
        </h2>
        <CmsRichText
          className="max-w-3xl text-base leading-relaxed text-mit-text"
          html={props.block.body}
        />
        {props.block.ctaLabel && props.block.ctaUrl ? (
          <div className="mt-8">
            <CmsBlockLink href={props.block.ctaUrl}>
              {props.block.ctaLabel}
            </CmsBlockLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CmsCalloutBlock(props: { block: PublicCmsBlock }) {
  return (
    <section className="border-b border-mit-line bg-mit-red-highlight py-12">
      <div className={blockInnerClassName}>
        <h2 className="mb-3 font-mit-serif text-2xl font-semibold text-mit-text">
          {props.block.title}
        </h2>
        <CmsRichText
          className="max-w-3xl text-sm leading-relaxed text-mit-text"
          html={props.block.body}
        />
        {props.block.ctaLabel && props.block.ctaUrl ? (
          <div className="mt-6">
            <CmsBlockLink href={props.block.ctaUrl}>
              {props.block.ctaLabel}
            </CmsBlockLink>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CmsBlock(props: { block: PublicCmsBlock; index: number }) {
  if (props.block.kind === 'hero') {
    return <CmsHeroBlock block={props.block} />;
  }
  if (props.block.kind === 'callout') {
    return <CmsCalloutBlock block={props.block} />;
  }
  return <CmsTextBlock block={props.block} index={props.index} />;
}

/**
 * Renders ordered CMS page blocks for public SSR pages.
 *
 * @param props - Published CMS page DTO
 * @returns Page block sequence
 */
export function CmsPageBlocks(props: { page: PublicCmsPage }) {
  return (
    <div className="min-h-0 min-w-0">
      {props.page.blocks.map((block, index) => (
        <CmsBlock block={block} index={index} key={block.id} />
      ))}
    </div>
  );
}
