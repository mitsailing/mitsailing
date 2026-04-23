import { setRequestLocale } from 'next-intl/server';
import { MarketingAuthNav } from '@/components/mit-sailing/MarketingAuthNav';
import { MitSailingMainNavList } from '@/components/mit-sailing/MitSailingMainNavList';
import { MitSailingSiteTemplate } from '@/components/mit-sailing/MitSailingSiteTemplate';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return (
    <MitSailingSiteTemplate
      leftNav={<MitSailingMainNavList locale={locale} />}
      rightNav={<MarketingAuthNav locale={locale} />}
    >
      {props.children}
    </MitSailingSiteTemplate>
  );
}
