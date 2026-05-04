import { ArrowRight } from 'lucide-react';
import Image from 'next/image';
import { SectionHeader } from '@/components/mit-sailing/home/SectionHeader';
import {
  dockHours,
  EXTERNAL,
  historyBlocks,
  missionBody,
  missionIntro,
  missionPillars,
  staff,
  staffProfilePath,
  volunteerIntro,
  volunteerSections,
} from '@/data/mit-sailing/aboutContent';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

const accent = `font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`;

/** Matches {@link SiteSectionMain} default column; inner wrapper while section bands stay full-viewport. */
const aboutSectionInner = 'mx-auto w-full max-w-5xl px-6';

function ExternalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      className={`inline-flex items-center gap-1 ${accent}`}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
      <ArrowRight aria-hidden className="size-4" />
    </a>
  );
}

function StaffCardImage(props: {
  imageSrc?: string;
  imageAlt?: string;
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
        className="flex h-14 w-14 items-center justify-center rounded-full bg-mit-red-highlight font-mit-serif text-xl font-bold text-mit-red-ink"
      >
        {props.name
          .split(' ')
          .map((w) => w[0])
          .join('')}
      </div>
    </div>
  );
}

function PillarCta(props: { href: string; label: string }) {
  if (props.href.startsWith('/')) {
    return (
      <Link
        className={`inline-flex items-center gap-1 ${accent}`}
        href={props.href}
      >
        {props.label}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  }
  return <ExternalLink href={props.href}>{props.label}</ExternalLink>;
}

/**
 * About MIT Sailing (mission, history, staff, volunteer, dock hours).
 * Data from `aboutContent.ts`; design aligned with `mit-redesign/AboutPage`.
 *
 * @returns Full About page
 */
export function AboutPageView() {
  return (
    <div className="min-h-0 min-w-0">
      <section className="border-b border-mit-line bg-background py-16 md:py-24">
        <div className={aboutSectionInner}>
          <h1 className="mb-6 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
            About MIT Sailing
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-mit-text">
            {missionIntro}
          </p>
        </div>
      </section>

      <section className="border-b border-mit-line bg-mit-surface py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle="How we serve the MIT community and grow lifelong skills on the water."
            title="Our mission"
          />
          <div className="mb-14 max-w-3xl space-y-6">
            {missionBody.map((p) => (
              <p className="text-base leading-relaxed text-mit-text" key={p}>
                {p}
              </p>
            ))}
          </div>
          <h3 className="mb-6 font-mit-serif text-lg font-semibold text-mit-text">
            How we carry out our mission
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {missionPillars.map((pillar) => (
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
                  <PillarCta href={pillar.cta.href} label={pillar.cta.label} />
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-mit-line bg-background py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle="From the first college sailing facility to a busy Charles River hub."
            title="History"
          />
          <div className="max-w-3xl space-y-8">
            {historyBlocks.map((block) => (
              <div className="flex items-start gap-4" key={block.text}>
                {block.year ? (
                  <span className="shrink-0 rounded-md bg-mit-red-highlight px-3 py-1 text-[11px] font-bold tracking-wider text-mit-red-ink uppercase">
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
              Your support helps maintain the Pavilion, sustain our fleets, and
              provide opportunities for students, alumni, and the wider
              community to sail.
            </p>
            <ExternalLink href={EXTERNAL.history}>
              History and giving on MIT Sailing
            </ExternalLink>
          </div>
        </div>
      </section>

      <section
        className="border-b border-mit-line bg-mit-surface py-16 md:py-24"
        id="staff"
      >
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle="Meet the people who keep instruction, the fleet, and the dock running."
            title="Staff"
          />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            {staff.map((person) => (
              <article
                className="flex h-full flex-col overflow-hidden rounded-xl border border-mit-line bg-card"
                key={person.name}
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
                    View profile
                    <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-mit-line bg-background py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader title="Volunteer" />
          <p className="mb-12 max-w-3xl text-base leading-relaxed text-mit-text">
            {volunteerIntro}
          </p>
          <div className="max-w-3xl space-y-12">
            {volunteerSections.map((block) => (
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
            <Link
              className={`inline-flex items-center gap-1 ${accent}`}
              href="/contact/"
            >
              Contact the Pavilion
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <ExternalLink href={EXTERNAL.calendar}>
              Calendar and regattas
            </ExternalLink>
            <Link
              className={`inline-flex items-center gap-1 ${accent}`}
              href="/about/mitna/"
            >
              MITNA Executive Committee
              <ArrowRight aria-hidden className="size-4" />
            </Link>
            <ExternalLink href={EXTERNAL.volunteer}>
              Volunteer page on MIT Sailing
            </ExternalLink>
          </div>
        </div>
      </section>

      <section className="bg-mit-surface py-16 md:py-24">
        <div className={aboutSectionInner}>
          <SectionHeader
            subtitle="Coaching, skills help, and rating tests when volunteers and staff are on the dock."
            title="Dock hours"
          />
          <div className="max-w-3xl rounded-xl border border-l-4 border-mit-line border-l-mit-red bg-card p-8">
            <p className="mb-6 text-base leading-relaxed text-mit-text">
              {dockHours.lead}
            </p>
            <p className="mb-6 text-sm leading-relaxed text-mit-text italic">
              {dockHours.disclaimer}
            </p>
            <p className="text-sm leading-relaxed text-mit-text">
              {dockHours.helmsman}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
