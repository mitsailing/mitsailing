import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { SectionHeader } from '@/components/mit-sailing/home/SectionHeader';
import { staffProfilePath } from '@/data/mit-sailing/aboutContent';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';
import type { AboutPageContent } from '@/libs/mit-sailing/aboutPageContent';
import {
  externalCmsLinkProps,
  isAppRelativeCmsHref,
  safeCmsHref,
} from '@/libs/mit-sailing/cmsHref';

const accent = `font-semibold text-mit-red no-underline hover:underline ${textFocusRingClassName} dark:text-mit-red-ink`;

/** Matches {@link SiteSectionMain} default column; inner wrapper while section bands stay full-viewport. */
const aboutSectionInner = 'mx-auto w-full max-w-5xl px-6';

function ExternalLink(props: { children: React.ReactNode; href: string }) {
  const safeHref = safeCmsHref(props.href);
  if (!safeHref || isAppRelativeCmsHref(safeHref)) {
    return null;
  }
  return (
    <a
      className={`inline-flex items-center gap-1 ${accent}`}
      href={safeHref}
      {...externalCmsLinkProps(safeHref)}
    >
      {props.children}
      <ArrowRight aria-hidden className="size-4" />
    </a>
  );
}

function StaffCardImage(props: {
  imageAlt?: string;
  imageSrc?: string;
  name: string;
}) {
  if (props.imageSrc && props.imageAlt) {
    return (
      <div className="relative aspect-16/10 w-full overflow-hidden bg-muted">
        <Image
          alt={props.imageAlt}
          className="h-full w-full object-cover object-top"
          height={500}
          sizes="(min-width: 768px) 50vw, 100vw"
          src={props.imageSrc}
          width={800}
        />
      </div>
    );
  }
  return (
    <div className="border-b border-mit-line px-8 pt-8 pb-2">
      <div
        aria-hidden
        className="flex h-14 w-14 items-center justify-center rounded-full bg-mit-red-highlight font-mit-serif text-xl font-bold text-mit-red dark:text-mit-red-ink"
      >
        {props.name
          .split(' ')
          .map((word) => word[0])
          .join('')}
      </div>
    </div>
  );
}

function ContentLink(props: { href: string; label: string }) {
  const href = safeCmsHref(props.href);
  if (!href) {
    return null;
  }
  if (isAppRelativeCmsHref(href)) {
    return (
      <Link className={`inline-flex items-center gap-1 ${accent}`} href={href}>
        {props.label}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  }
  return <ExternalLink href={href}>{props.label}</ExternalLink>;
}

type AboutPageViewProps = {
  content: AboutPageContent;
  profileLabel: string;
};

/**
 * About MIT Sailing. Layout stays fixed; copy and staff cards come from Payload.
 *
 * @param props - Resolved section copy and staff cards
 * @returns Full About page
 */
export function AboutPageView(props: AboutPageViewProps) {
  const { content } = props;
  return (
    <div className="min-h-0 min-w-0">
      <section className="border-b border-mit-line bg-background py-16 md:py-24">
        <div className={aboutSectionInner}>
          <h1 className="mb-6 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
            {content.introTitle}
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-mit-text">
            {content.introBody}
          </p>
        </div>
      </section>

      <section className="border-b border-mit-line bg-mit-surface py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle={content.missionSubtitle}
            title={content.missionTitle}
          />
          <div className="mb-14 max-w-3xl space-y-6">
            {content.missionParagraphs.map((paragraph) => (
              <p
                className="text-base leading-relaxed text-mit-text"
                key={paragraph}
              >
                {paragraph}
              </p>
            ))}
          </div>
          <h3 className="mb-6 font-mit-serif text-lg font-semibold text-mit-text">
            {content.missionPillarsHeading}
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {content.missionPillars.map((pillar) => (
              <div
                className="flex h-full flex-col rounded-xl border border-mit-line bg-card p-8"
                key={pillar.title}
              >
                <h4 className="mb-3 font-mit-serif text-lg font-semibold text-mit-text">
                  {pillar.title}
                </h4>
                <p className="mb-4 flex-1 text-sm leading-relaxed text-mit-text">
                  {pillar.body}
                </p>
                {pillar.cta ? (
                  <ContentLink
                    href={pillar.cta.href}
                    label={pillar.cta.label}
                  />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-mit-line bg-background py-14 md:py-18">
        <div className={aboutSectionInner}>
          <div className="grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-start">
            <div>
              <SectionHeader
                subtitle={content.membershipBody}
                title={content.membershipTitle}
              />
              <ContentLink
                href={content.membershipCta.href}
                label={content.membershipCta.label}
              />
            </div>
            <dl className="divide-y divide-mit-line border-y border-mit-line text-sm text-mit-text">
              {content.membershipOptions.map((option) => (
                <div className="py-4 leading-relaxed" key={option.title}>
                  <dt className="font-semibold text-mit-text">
                    {option.title}
                  </dt>
                  <dd className="mt-1 text-muted-foreground">{option.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      <section
        className="scroll-mt-24 border-b border-mit-line bg-background py-16 md:py-24"
        id="history"
      >
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle={content.historySubtitle}
            title={content.historyTitle}
          />
          <div className="max-w-3xl space-y-8">
            {content.historyEntries.map((block) => (
              <div className="flex items-start gap-4" key={block.text}>
                {block.year ? (
                  <span className="shrink-0 rounded-md bg-mit-red-highlight px-3 py-1 text-[11px] font-bold tracking-wider text-mit-red uppercase dark:text-mit-red-ink">
                    {block.year}
                  </span>
                ) : (
                  <span aria-hidden className="w-14 shrink-0" />
                )}
                <p className="text-base leading-relaxed text-mit-text">
                  {block.text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-10 max-w-3xl rounded-xl border border-mit-line bg-mit-red-highlight p-6">
            <p className="mb-3 text-sm leading-relaxed text-mit-text">
              {content.historySupport.text}
            </p>
            <ContentLink
              href={content.historySupport.href}
              label={content.historySupport.label}
            />
          </div>
        </div>
      </section>

      <section
        className="scroll-mt-24 border-b border-mit-line bg-mit-surface py-16 md:py-24"
        id="staff"
      >
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle={content.staffSubtitle}
            title={content.staffTitle}
          />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {content.staff.map((person) => (
              <article
                className="flex h-full flex-col overflow-hidden rounded-xl border border-mit-line bg-card"
                key={person.slug}
              >
                <StaffCardImage
                  imageAlt={person.imageAlt}
                  imageSrc={person.imageSrc}
                  name={person.name}
                />
                <div className="flex flex-1 flex-col p-8">
                  <h3 className="mb-1 font-mit-serif text-xl font-semibold text-mit-text">
                    {person.name}
                  </h3>
                  <p className="mb-4 text-sm text-mit-text italic">
                    {person.role}
                  </p>
                  {person.bio ? (
                    <p className="mb-6 flex-1 text-sm leading-relaxed text-mit-text">
                      {person.bio}
                    </p>
                  ) : (
                    <div className="mb-6 flex-1" />
                  )}
                  <Link
                    className={`mt-auto inline-flex items-center gap-1 ${accent}`}
                    href={staffProfilePath(person.slug)}
                  >
                    {props.profileLabel}
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        className="scroll-mt-24 border-b border-mit-line bg-background py-16 md:py-24"
        id="volunteer"
      >
        <div className={aboutSectionInner}>
          <SectionHeader title={content.volunteerTitle} />
          <p className="mb-12 max-w-3xl text-base leading-relaxed text-mit-text">
            {content.volunteerIntro}
          </p>
          <div className="max-w-3xl space-y-12">
            {content.volunteerSections.map((block) => (
              <div key={block.title}>
                <h3 className="mb-3 font-mit-serif text-lg font-semibold text-mit-text">
                  {block.title}
                </h3>
                <p className="mb-4 text-sm leading-relaxed text-mit-text">
                  {block.body}
                </p>
                {block.bullets ? (
                  <ul className="mb-4 list-disc space-y-2 pl-5 text-sm text-mit-text">
                    {block.bullets.map((item) => (
                      <li className="leading-relaxed" key={item}>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {block.footnote ? (
                  <p className="mb-4 text-sm text-mit-text italic">
                    {block.footnote}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-10 flex flex-col flex-wrap gap-6 sm:flex-row">
            {content.volunteerLinks.map((link) => (
              <ContentLink
                href={link.href}
                key={link.href}
                label={link.label}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="bg-mit-surface py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle={content.dockHoursSubtitle}
            title={content.dockHoursTitle}
          />
          <div className="max-w-3xl rounded-xl border border-mit-line bg-card p-8">
            <p className="mb-6 text-base leading-relaxed text-mit-text">
              {content.dockHoursLead}
            </p>
            <p className="mb-6 text-sm leading-relaxed text-mit-text italic">
              {content.dockHoursDisclaimer}
            </p>
            <p className="text-sm leading-relaxed text-mit-text">
              {content.dockHoursHelmsman}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
