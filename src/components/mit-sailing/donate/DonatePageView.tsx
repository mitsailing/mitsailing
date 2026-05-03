import { HeartHandshake, Mail } from 'lucide-react';
import { DonateAlternateGivingSection } from '@/components/mit-sailing/donate/DonateAlternateGivingSection';
import { DonationFundCard } from '@/components/mit-sailing/donate/DonationFundCard';
import { DonationSupportOption } from '@/components/mit-sailing/donate/DonationSupportOption';
import { cn } from '@/lib/utils';
import type { VisibleDonationFundRow } from '@/libs/mit-sailing/donationFundQueries';

const donateH2 =
  'font-mit-serif text-[22px] font-semibold tracking-tight text-mit-text';

export type DonatePageViewProps = {
  heading: string;
  introParagraphs: [string, string];
  corporateGiving: {
    heading: string;
    body: string;
    contactIntro: string;
    contactName: string;
    contactRole: string;
    contactEmail: string;
  };
  individualHeading: string;
  funds: readonly VisibleDonationFundRow[];
  fundNumberLabel: (fundId: string) => string;
  giveCta: string;
  supportHeading: string;
  mailingTitle: string;
  mailingBody: string;
  mailingLinkLabel: string;
  mailingHref: string;
  volunteerTitle: string;
  volunteerBody: string;
  volunteerLinkLabel: string;
  volunteerHref: string;
  alternateGiving: {
    heading: string;
    blocks: readonly { title: string; body: string }[];
    contactHeading: string;
    contactIntro: string;
    contactName: string;
    contactRole: string;
    contactEmail: string;
    legalDisclaimer: string;
  };
};

/**
 * Marketing donate page body: hero, corporate callout, fund list, and secondary support options.
 *
 * @param props - Resolved copy and fund rows from the server page.
 * @returns Main column sections for the donate route.
 */
export function DonatePageView(props: DonatePageViewProps) {
  return (
    <div className="w-full pb-24 font-sans text-mit-text">
      <header className="mb-12 max-w-3xl">
        <h1 className="mb-6 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
          {props.heading}
        </h1>
        <div className="max-w-3xl space-y-4 text-base leading-relaxed text-mit-text">
          <p>{props.introParagraphs[0]}</p>
          <p>{props.introParagraphs[1]}</p>
        </div>
      </header>

      <section
        aria-labelledby="donate-corporate-heading"
        className="mb-12 max-w-3xl space-y-4 text-base leading-relaxed text-mit-text"
      >
        <h2 className={cn('mb-6', donateH2)} id="donate-corporate-heading">
          {props.corporateGiving.heading}
        </h2>
        <p>{props.corporateGiving.body}</p>
        <p>
          {props.corporateGiving.contactIntro}{' '}
          {props.corporateGiving.contactName},{' '}
          {props.corporateGiving.contactRole},{' '}
          <a href={`mailto:${props.corporateGiving.contactEmail}`}>
            {props.corporateGiving.contactEmail}
          </a>
        </p>
      </section>

      <h2 className={cn('mb-6', donateH2)} id="donate-individual-heading">
        {props.individualHeading}
      </h2>

      <ul className="mb-20 list-none space-y-6 p-0">
        {props.funds.map((fund) => (
          <li key={fund.id}>
            <DonationFundCard
              description={fund.description}
              fundNumberLabel={props.fundNumberLabel(fund.fundId)}
              giveLabel={props.giveCta}
              name={fund.name}
              url={fund.url}
            />
          </li>
        ))}
      </ul>

      <DonateAlternateGivingSection
        blocks={props.alternateGiving.blocks}
        contactEmail={props.alternateGiving.contactEmail}
        contactHeading={props.alternateGiving.contactHeading}
        contactIntro={props.alternateGiving.contactIntro}
        contactName={props.alternateGiving.contactName}
        contactRole={props.alternateGiving.contactRole}
        heading={props.alternateGiving.heading}
        legalDisclaimer={props.alternateGiving.legalDisclaimer}
      />

      <section
        aria-labelledby="donate-support-alt-heading"
        className="rounded-xl border border-mit-line bg-mit-surface p-6 sm:p-8"
      >
        <h2 className={cn('mb-6', donateH2)} id="donate-support-alt-heading">
          {props.supportHeading}
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <DonationSupportOption
            body={props.mailingBody}
            icon={Mail}
            linkHref={props.mailingHref}
            linkLabel={props.mailingLinkLabel}
            title={props.mailingTitle}
          />
          <DonationSupportOption
            body={props.volunteerBody}
            icon={HeartHandshake}
            linkHref={props.volunteerHref}
            linkLabel={props.volunteerLinkLabel}
            title={props.volunteerTitle}
          />
        </div>
      </section>
    </div>
  );
}
