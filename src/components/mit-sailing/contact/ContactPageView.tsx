import { MapPin, Phone } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { ContactForm } from '@/components/mit-sailing/contact/ContactForm';
import {
  mashneeBluewaterLocation,
  mashneeDirectionsPath,
  pavilionHours,
  pavilionLegalAddress,
  pavilionPhone,
  pavilionShippingAddress,
  pavilionStreetAddress,
} from '@/data/mit-sailing/pavilionInfoSeed';
import type { PavilionAddressBlock } from '@/data/mit-sailing/pavilionInfoSeed';
import { textFocusRingClassName } from '@/lib/mit-sailing/tokens';
import { Link } from '@/libs/I18nNavigation';

type ContactPageViewProps = {
  locale: string;
};

type ContactT = Awaited<
  ReturnType<typeof getTranslations<'MitSailingContact'>>
>;

type PavilionDay = (typeof pavilionHours.schedule)[number]['day'];

const sectionHeading =
  'mb-4 font-mit-serif text-[22px] font-semibold tracking-tight text-mit-text';

const panelClassName = 'rounded-xl border border-mit-line bg-card p-5 md:p-6';

const addressLinkClassName = `flex items-start gap-2 text-sm leading-relaxed text-mit-text no-underline hover:underline ${textFocusRingClassName}`;

function pavilionDayLabel(day: PavilionDay, t: ContactT): string {
  switch (day) {
    case 'Monday': {
      return t('hours_day_monday');
    }
    case 'Tuesday': {
      return t('hours_day_tuesday');
    }
    case 'Wednesday': {
      return t('hours_day_wednesday');
    }
    case 'Thursday': {
      return t('hours_day_thursday');
    }
    case 'Friday': {
      return t('hours_day_friday');
    }
    case 'Saturday': {
      return t('hours_day_saturday');
    }
    case 'Sunday': {
      return t('hours_day_sunday');
    }
    default: {
      const _exhaustive: never = day;
      return _exhaustive;
    }
  }
}

function AddressBlockContent(props: {
  block: PavilionAddressBlock;
  phone?: { href: string; display: string };
  t: ContactT;
}) {
  return (
    <div className="space-y-3">
      <h3 className="font-mit-serif text-[17px] font-semibold text-mit-text">
        {props.block.title}
      </h3>
      <address className="m-0 not-italic">
        <a
          aria-label={props.t('address_maps_aria', {
            title: props.block.title,
          })}
          className={addressLinkClassName}
          href={props.block.mapsUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          <MapPin
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-mit-red-ink"
          />
          <span className="min-w-0">
            {props.block.lines.map((line) => (
              <span className="block" key={`${props.block.id}-${line}`}>
                {line}
              </span>
            ))}
          </span>
        </a>
      </address>
      {props.phone ? (
        <p className="m-0 flex items-center gap-2 text-sm leading-relaxed">
          <Phone aria-hidden className="size-4 shrink-0 text-mit-red-ink" />
          <a
            className={`font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
            href={props.phone.href}
          >
            <span className="sr-only">{props.t('phone_sr')}</span>
            {props.phone.display}
          </a>
        </p>
      ) : null}
      {props.block.notes?.map((note) => (
        <p
          className="m-0 pt-4 text-sm leading-relaxed font-medium text-mit-text"
          key={`${props.block.id}-note-${note}`}
        >
          {note}
        </p>
      ))}
    </div>
  );
}

/**
 * Contact and directions page body: message form, hours, and location cards.
 *
 * @param props - Active locale for translations and the contact form action
 * @returns Public contact page content
 */
export async function ContactPageView(props: ContactPageViewProps) {
  const t = await getTranslations({
    locale: props.locale,
    namespace: 'MitSailingContact',
  });

  return (
    <div className="w-full pb-24 font-sans text-mit-text">
      <header className="mb-10 max-w-3xl md:mb-12">
        <h1 className="mb-4 font-mit-serif text-3xl leading-tight font-bold text-mit-text md:text-4xl">
          {t('heading')}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-mit-text">
          {t('intro')}
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-12 lg:gap-12">
        <div className="lg:col-span-7 xl:col-span-6">
          <article
            aria-labelledby="contact-form-title"
            className="rounded-xl border border-mit-line bg-card p-6 shadow-sm sm:p-8 md:p-10"
          >
            <div
              className="mb-8 rounded-xl border border-mit-line bg-mit-red-highlight p-4 text-sm leading-relaxed text-mit-text md:p-5"
              id="contact-form-note"
            >
              <p className="m-0 font-medium">{t('form_note')}</p>
            </div>

            <h2
              className="mb-2 font-mit-serif text-2xl font-bold tracking-tight text-mit-text"
              id="contact-form-title"
            >
              {t('form_heading')}
            </h2>
            <p className="mb-8 text-base leading-relaxed text-mit-text">
              {t('form_intro')}
            </p>

            <ContactForm locale={props.locale} />
          </article>
        </div>

        <aside className="space-y-8 lg:sticky lg:top-24 lg:col-span-5 xl:col-span-6">
          <section aria-labelledby="hours-heading" id="hours">
            <h2 className={sectionHeading} id="hours-heading">
              {t('hours_heading')}
            </h2>
            <p className="m-0 mb-4 text-sm leading-relaxed text-mit-text">
              {t('hours_subtitle')}
            </p>
            <div className={panelClassName}>
              <table className="w-full text-left text-sm">
                <tbody>
                  {pavilionHours.schedule.map((row) => (
                    <tr
                      className="border-b border-mit-line last:border-b-0"
                      key={row.day}
                    >
                      <th
                        className="py-2.5 pr-4 text-left align-top font-semibold text-mit-text"
                        scope="row"
                      >
                        {pavilionDayLabel(row.day, t)}
                      </th>
                      <td className="py-2.5 align-top text-mit-text">
                        {row.hours}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-labelledby="locations-heading" id="locations">
            <h2 className={sectionHeading} id="locations-heading">
              {t('locations_heading')}
            </h2>
            <p className="m-0 mb-4 text-sm leading-relaxed text-mit-text">
              {t('locations_intro')}
            </p>
            <div className={panelClassName}>
              <div className="border-b border-mit-line pb-8">
                <AddressBlockContent
                  block={pavilionStreetAddress}
                  phone={{
                    display: pavilionPhone.display,
                    href: pavilionPhone.telHref,
                  }}
                  t={t}
                />
              </div>
              <div className="border-b border-mit-line py-8">
                <AddressBlockContent block={pavilionShippingAddress} t={t} />
              </div>
              <div className="border-b border-mit-line py-8">
                <AddressBlockContent block={pavilionLegalAddress} t={t} />
              </div>
              <div className="space-y-3 pt-8">
                <h3 className="font-mit-serif text-[17px] font-semibold text-mit-text">
                  {t('mashnee_location_title')}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-mit-text">
                  {t('mashnee_location_summary')}
                </p>
                <address className="m-0 not-italic">
                  <a
                    aria-label={t('address_maps_aria', {
                      title: t('mashnee_location_title'),
                    })}
                    className={addressLinkClassName}
                    href={mashneeBluewaterLocation.mapsUrl}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <MapPin
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-mit-red-ink"
                    />
                    <span className="min-w-0">
                      {mashneeBluewaterLocation.lines.map((line) => (
                        <span className="block" key={`mashnee-${line}`}>
                          {line}
                        </span>
                      ))}
                    </span>
                  </a>
                </address>
                <p className="m-0">
                  <Link
                    className={`inline-flex items-center gap-1 text-sm font-semibold text-mit-red-ink no-underline hover:underline ${textFocusRingClassName}`}
                    href={mashneeDirectionsPath}
                  >
                    {t('mashnee_directions_link')}
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
