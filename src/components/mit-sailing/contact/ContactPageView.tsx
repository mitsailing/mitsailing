import { Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import type * as React from 'react';
import { ContactFormDialog } from '@/components/mit-sailing/contact/ContactFormDialog';
import {
  mashneeBluewaterLocation,
  mashneeDirections,
  pavilionDirections,
  pavilionLegalAddress,
  pavilionPhone,
  pavilionShippingAddress,
  pavilionStreetAddress,
} from '@/data/mit-sailing/pavilionInfoSeed';
import type { PavilionAddressBlock } from '@/data/mit-sailing/pavilionInfoSeed';
import { keyedStringItems } from '@/lib/keyedStringList';

type ContactPageViewProps = {
  currentYear: number;
  formAction: (formData: FormData) => Promise<void>;
  locale: string;
  status?: 'error' | 'invalid' | 'sent';
};

const sectionClassName = 'border-t border-mit-line py-10 md:py-12';
const helperClassName = 'text-sm leading-relaxed text-muted-foreground';

function SectionHeading(props: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-6 max-w-3xl">
      {props.eyebrow ? (
        <p className="mb-2 text-xs font-bold tracking-widest text-primary-ink uppercase">
          {props.eyebrow}
        </p>
      ) : null}
      <h2 className="font-mit-serif text-2xl font-semibold text-mit-text">
        {props.title}
      </h2>
      {props.children ? (
        <div className="mt-3 text-base leading-relaxed text-mit-text">
          {props.children}
        </div>
      ) : null}
    </div>
  );
}

function AddressLines(props: { lines: readonly string[] }) {
  return (
    <address className="space-y-1 text-sm leading-relaxed text-mit-text not-italic">
      {keyedStringItems(props.lines).map((line) => (
        <div key={line.key}>{line.value}</div>
      ))}
    </address>
  );
}

function AddressSummary(props: {
  address: PavilionAddressBlock;
  title: string;
}) {
  return (
    <section className="border-t border-mit-line pt-4">
      <h3 className="mb-2 text-sm font-semibold text-mit-text">
        {props.title}
      </h3>
      <AddressLines lines={props.address.lines} />
    </section>
  );
}

function DirectionList(props: {
  title: string;
  items: readonly string[];
  ordered?: boolean;
}) {
  const ListTag = props.ordered ? 'ol' : 'ul';
  return (
    <div>
      <h3 className="mb-3 text-base font-semibold text-mit-text">
        {props.title}
      </h3>
      <ListTag
        className={
          props.ordered
            ? 'list-decimal space-y-2 pl-5 text-sm leading-relaxed text-mit-text'
            : 'list-disc space-y-2 pl-5 text-sm leading-relaxed text-mit-text'
        }
      >
        {keyedStringItems(props.items).map((item) => (
          <li key={item.key}>{item.value}</li>
        ))}
      </ListTag>
    </div>
  );
}

function MapLink(props: { href: string; children: React.ReactNode }) {
  return (
    <a
      className="inline-flex items-center gap-1 rounded-sm text-sm font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      href={props.href}
      rel="noopener noreferrer"
      target="_blank"
    >
      <MapPin aria-hidden className="size-4" />
      {props.children}
    </a>
  );
}

/**
 * Renders the structured public contact page below CMS intro blocks.
 *
 * @param props - Contact form action, submit status, and current year
 * @returns Three-path contact UI, compact address details, and directions
 */
export async function ContactPageView(props: ContactPageViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingContact',
  });

  return (
    <div className="space-y-0">
      <section className={sectionClassName}>
        <SectionHeading eyebrow={t('start_eyebrow')} title={t('start_title')}>
          <p>{t('start_intro')}</p>
        </SectionHeading>
        <ContactFormDialog
          currentYear={props.currentYear}
          formAction={props.formAction}
          status={props.status}
        />
        <div className="mt-6 grid gap-3 rounded-lg border border-mit-line bg-mit-surface p-4 text-sm text-mit-text md:grid-cols-3">
          <a
            className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            href={pavilionPhone.telHref}
          >
            <Phone aria-hidden className="size-4" />
            {pavilionPhone.display}
          </a>
          <a
            className="inline-flex items-center gap-2 rounded-sm font-semibold text-primary-ink underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
            href="mailto:sailing@mit.edu"
          >
            <Mail aria-hidden className="size-4" />
            {t('email_display')}
          </a>
          <span className="inline-flex items-center gap-2">
            <Navigation aria-hidden className="size-4 text-primary-ink" />
            {t('pavilion_short_address')}
          </span>
        </div>
      </section>

      <section className={sectionClassName} id="pavilion-directions">
        <SectionHeading title={t('visit_title')}>
          <p>{t('visit_intro')}</p>
        </SectionHeading>
        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-lg border border-mit-line bg-background p-5">
            <h3 className="mb-3 text-base font-semibold text-mit-text">
              {pavilionDirections.title}
            </h3>
            <p className="mb-5 text-sm leading-relaxed text-mit-text">
              {pavilionDirections.summary}
            </p>
            <DirectionList
              items={pavilionDirections.steps}
              ordered
              title={t('directions_getting_there')}
            />
            <div className="mt-5">
              <MapLink href={pavilionDirections.mapsUrl}>
                {pavilionDirections.ctaLabel}
              </MapLink>
            </div>
          </section>
          <section
            className="rounded-lg border border-mit-red/30 bg-mit-red-highlight p-5"
            id="mashnee-directions"
          >
            <p className="mb-3 text-xs font-bold tracking-widest text-primary-ink uppercase">
              {t('bluewater_location')}
            </p>
            <h3 className="mb-3 text-base font-semibold text-mit-text">
              {mashneeDirections.title}
            </h3>
            <p className="mb-5 text-base font-semibold text-mit-text">
              {mashneeDirections.warning}
            </p>
            <div className="mb-5 border-t border-mit-red/20 pt-4">
              <h4 className="mb-2 text-sm font-semibold text-mit-text">
                {mashneeBluewaterLocation.title}
              </h4>
              <AddressLines lines={mashneeBluewaterLocation.lines} />
            </div>
            <div className="space-y-6">
              <DirectionList
                items={mashneeDirections.walkingSteps}
                ordered
                title={mashneeDirections.walkingTitle}
              />
              <DirectionList
                items={mashneeDirections.parkingNotes}
                title={mashneeDirections.parkingTitle}
              />
            </div>
            <div className="mt-5">
              <MapLink href={mashneeDirections.mapsUrl}>
                {mashneeDirections.ctaLabel}
              </MapLink>
            </div>
          </section>
        </div>
      </section>

      <section className={sectionClassName}>
        <SectionHeading title={t('addresses_title')}>
          <p>{t('addresses_intro')}</p>
        </SectionHeading>
        <div className="grid gap-5 rounded-lg border border-mit-line bg-background p-5 md:grid-cols-3">
          <AddressSummary
            address={pavilionStreetAddress}
            title={t('street_address_title')}
          />
          <AddressSummary
            address={pavilionShippingAddress}
            title={t('shipping_address_title')}
          />
          <AddressSummary
            address={pavilionLegalAddress}
            title={t('legal_address_title')}
          />
        </div>
        <p className={`mt-4 ${helperClassName}`}>{t('addresses_warning')}</p>
      </section>
    </div>
  );
}
