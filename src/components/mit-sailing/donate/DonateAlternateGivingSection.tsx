import { cn } from '@/lib/utils';

export type DonateAlternateGivingBlock = {
  title: string;
  body: string;
};

export type DonateAlternateGivingSectionProps = {
  heading: string;
  blocks: readonly DonateAlternateGivingBlock[];
  contactHeading: string;
  contactIntro: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  legalDisclaimer: string;
  className?: string;
};

/**
 * Long-form alternate giving methods (check, wire, DAF, securities) plus primary contact and legal note.
 *
 * @param props - Copy from MitSailingDonate; email rendered as a mailto link.
 * @returns Alternate giving methods column (plain background; sits above mailing/support panel).
 */
export function DonateAlternateGivingSection(
  props: DonateAlternateGivingSectionProps
) {
  return (
    <section
      aria-labelledby="donate-alt-give-heading"
      className={cn('mb-10', props.className)}
    >
      <h2
        className="mb-8 font-mit-serif text-[22px] font-semibold tracking-tight text-mit-text"
        id="donate-alt-give-heading"
      >
        {props.heading}
      </h2>

      <div className="space-y-8 text-base leading-relaxed text-mit-text">
        {props.blocks.map((block) => (
          <div key={block.title}>
            <h3 className="mb-2 font-semibold text-mit-text">{block.title}</h3>
            <p className="whitespace-pre-line">{block.body}</p>
          </div>
        ))}

        <div>
          <h3 className="mb-2 font-semibold text-mit-text">
            {props.contactHeading}
          </h3>
          <p className="mb-4">{props.contactIntro}</p>
          <p className="font-semibold text-mit-text">{props.contactName}</p>
          <p className="text-mit-text">{props.contactRole}</p>
          <p className="mt-2">
            <a
              className="font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:outline-none"
              href={`mailto:${props.contactEmail}`}
            >
              {props.contactEmail}
            </a>
          </p>
        </div>

        <p className="text-sm font-semibold text-mit-text italic">
          {props.legalDisclaimer}
        </p>
      </div>
    </section>
  );
}
