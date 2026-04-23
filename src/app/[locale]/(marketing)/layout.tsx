import { setRequestLocale } from 'next-intl/server';
import { MitSailingSiteTemplate } from '@/components/mit-sailing/MitSailingSiteTemplate';

export default async function Layout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return <MitSailingSiteTemplate>{props.children}</MitSailingSiteTemplate>;
}
