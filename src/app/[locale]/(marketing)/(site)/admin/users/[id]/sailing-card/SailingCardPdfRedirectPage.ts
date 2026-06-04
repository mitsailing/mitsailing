import { setRequestLocale } from 'next-intl/server';
import { redirect } from 'next/navigation';

export type SailingCardPdfRedirectPageProps = {
  readonly params: Promise<{ id: string; locale: string }>;
};

export async function sailingCardPdfRedirectParams(
  props: SailingCardPdfRedirectPageProps
) {
  const { id, locale } = await props.params;
  setRequestLocale(locale);

  return { id, locale };
}

export function redirectToSailingCardPdf(id: string) {
  redirect(`/api/admin/users/${encodeURIComponent(id)}/sailing-card/pdf`);
}
