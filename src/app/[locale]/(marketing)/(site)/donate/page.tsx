import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { DonatePageView } from '@/components/mit-sailing/donate/DonatePageView';
import { SiteSectionMain } from '@/components/mit-sailing/SiteSectionMain';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getVisibleDonationFunds } from '@/libs/mit-sailing/donationFundQueries';

type PageProps = { params: Promise<{ locale: string }> };

/** Pairs of MitSailingDonate keys for alternate giving blocks (check, wire, DAF, securities). */
const ALT_GIVE_BLOCK_MESSAGE_KEYS = [
  ['alt_give_check_title', 'alt_give_check_body'],
  ['alt_give_wire_title', 'alt_give_wire_body'],
  ['alt_give_daf_title', 'alt_give_daf_body'],
  ['alt_give_securities_title', 'alt_give_securities_body'],
] as const;

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  return { title: t('meta_title_donate') };
}

export default async function DonatePage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const tRoutes = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingDonate',
  });

  const funds = await getVisibleDonationFunds();

  return (
    <SiteSectionShell
      locale={locale}
      segments={[{ label: tRoutes('section_donate') }]}
    >
      <SiteSectionMain maxWidth="5xl" variant="detail">
        <DonatePageView
          corporateGiving={{
            body: t('corporate_body'),
            contactEmail: t('corporate_contact_email'),
            contactIntro: t('corporate_contact_intro'),
            contactName: t('corporate_contact_name'),
            contactRole: t('alt_give_contact_role'),
            heading: t('corporate_heading'),
          }}
          individualHeading={t('individual_heading')}
          alternateGiving={{
            blocks: ALT_GIVE_BLOCK_MESSAGE_KEYS.map(([titleKey, bodyKey]) => ({
              title: t(titleKey),
              body: t(bodyKey),
            })),
            contactEmail: t('alt_give_contact_email'),
            contactHeading: t('alt_give_contact_heading'),
            contactIntro: t('alt_give_contact_intro'),
            contactName: t('alt_give_contact_name'),
            contactRole: t('alt_give_contact_role'),
            heading: t('alt_give_heading'),
            legalDisclaimer: t('alt_give_legal'),
          }}
          fundNumberLabel={(fundId) =>
            t('fund_number_label', { number: `#${fundId}` })
          }
          funds={funds}
          giveCta={t('give_cta')}
          heading={t('heading')}
          introParagraphs={[t('intro_p1'), t('intro_p2')]}
          mailingBody={t('mailing_body')}
          mailingHref="/contact"
          mailingLinkLabel={t('mailing_link')}
          mailingTitle={t('mailing_title')}
          supportHeading={t('support_heading')}
          volunteerBody={t('volunteer_body')}
          volunteerHref="/contact"
          volunteerLinkLabel={t('volunteer_link')}
          volunteerTitle={t('volunteer_title')}
        />
      </SiteSectionMain>
    </SiteSectionShell>
  );
}
