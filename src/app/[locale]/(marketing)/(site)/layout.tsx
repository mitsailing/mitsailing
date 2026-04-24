import { SiteShell } from '@/components/mit-sailing/SiteShell';

/**
 * Standard marketing pages: global pavilion chrome (conditions bar, header,
 * footer). Auth-only flows use `src/app/[locale]/(auth)/` instead.
 *
 * Locale is set in the parent `(marketing)/layout.tsx`.
 *
 * @param props - Layout props
 * @param props.children - Page content under `(site)/`
 * @returns Marketing pages wrapped in {@link SiteShell}
 */
export default function MarketingSiteLayout(props: {
  children: React.ReactNode;
}) {
  return <SiteShell>{props.children}</SiteShell>;
}
