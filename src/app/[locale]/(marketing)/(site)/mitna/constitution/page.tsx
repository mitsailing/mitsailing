import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PublicAdminEditLink } from '@/components/mit-sailing/admin/PublicAdminEditLink';
import { PayloadLexicalRichText } from '@/components/mit-sailing/cms/PayloadLexicalRichText';
import { MitnaMarketingPageShell } from '@/components/mit-sailing/MitnaMarketingPageShell';
import { loadMitnaPageBySlug } from '@/libs/mit-sailing/loadMitnaPageContent';

type PageProps = { params: Promise<{ locale: string }> };

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { locale } = await props.params;
  const [t, page] = await Promise.all([
    getTranslations({ locale, namespace: 'MitSailingRoutes' }),
    loadMitnaPageBySlug('mitna/constitution'),
  ]);
  return { title: page?.title ?? t('meta_title_mitna_constitution') };
}

export default async function MitnaConstitutionPage(props: PageProps) {
  const { locale } = await props.params;
  setRequestLocale(locale);
  const page = await loadMitnaPageBySlug('mitna/constitution');
  if (!page) {
    notFound();
  }
  return (
    <MitnaMarketingPageShell locale={locale} page="constitution">
      <PublicAdminEditLink
        className="mb-4"
        href={`/cms/collections/pages/${page.id}`}
      />
      <PayloadLexicalRichText
        className="cms-rich-text prose prose-mit max-w-none text-mit-text"
        data={page.body}
      />
    </MitnaMarketingPageShell>
  );
}
