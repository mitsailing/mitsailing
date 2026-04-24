import { getTranslations } from 'next-intl/server';
import { SiteSectionShell } from '@/components/mit-sailing/SiteSectionShell';
import { getStaffBySlug } from '@/data/mit-sailing/aboutContent';

export default async function AboutStaffLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  const t = await getTranslations({
    locale,
    namespace: 'MitSailingRoutes',
  });
  const staff = getStaffBySlug(slug);
  const name = staff?.name ?? slug;
  return (
    <SiteSectionShell
      locale={locale}
      segments={[
        { href: '/about/', label: t('section_about') },
        { label: name },
      ]}
    >
      {props.children}
    </SiteSectionShell>
  );
}
