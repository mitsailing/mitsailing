import { SiteShell } from '@/components/mit-sailing/SiteShell';

/**
 * Home (`/`) layout: same global chrome as inner marketing pages today; split so
 * you can change hero width, metadata patterns, or shell without touching the
 * rest of the site tree.
 *
 * Locale is set in the parent `(marketing)/layout.tsx`.
 *
 * @param props - Layout props
 * @param props.children - Home page content
 * @returns Home route wrapped in {@link SiteShell}
 */
export default function HomeLayout(props: { children: React.ReactNode }) {
  return <SiteShell>{props.children}</SiteShell>;
}
