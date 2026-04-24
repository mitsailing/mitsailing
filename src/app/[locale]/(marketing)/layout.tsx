import { setRequestLocale } from 'next-intl/server';

/**
 * Marketing segment: locale only. Nested route groups pick their own chrome:
 * - `(home)` — landing (`/`)
 * - `(site)` — pages that share the global pavilion header/footer
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/layout
 * @param props - Layout props
 * @param props.children - Nested route segments
 * @param props.params - Dynamic `[locale]` params
 * @returns Child tree with request locale configured
 */
export default async function MarketingSegmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await props.params;
  setRequestLocale(locale);

  return props.children;
}
