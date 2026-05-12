/**
 * Shell class helpers (`mit-theme.css` owns hex). Use `tokens.colors` only for
 * inline styles / SVG when Tailwind utilities are awkward.
 */
export const tokens = {
  colors: {
    /** Light foreground; matches `:root --foreground` in mit-theme.css. */
    text: '#09090b',
    mitRed: '#750014',
    mitRedHover: '#590010',
    mitRedHighlight: '#fef2f2',
    surface: '#f4f4f5',
    border: '#e4e4e7',
    /** MIT expanded palette (optional emphasis; not default primary). */
    mitRedBright: '#ff1423',
    mitSilverGray: '#8b959e',
    mitRed50: '#fef2f2',
    mitRed600: '#750014',
    mitRed950: '#1a0005',
    /** Matches `:root --mit-success` (Tailwind green-600 scale) in mit-theme.css. */
    mitSuccess: '#00a63e',
    /** Matches `:root --mit-success-ink`; use for SVG/stroke on light surfaces / success tints. */
    mitSuccessInk: '#117e38',
  },
  typography: {
    small: 'text-sm',
  },
} as const;

export const textFocusRingClassName =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export const footerHorizontalRuleClassName = 'h-px flex-1 bg-white/20';

export const footerLinkClassName =
  'underline-offset-4 hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm';

export const footerNavSectionHeadingClassName =
  'text-xs font-bold uppercase tracking-widest text-white';

export const footerSocialGroupLabelClassName =
  'shrink-0 text-left text-sm font-semibold tracking-tight text-white';

export const footerNavLinkClassName = 'text-sm text-white';

export const footerLegalLinkClassName = 'text-xs text-white';

export const footerCopyrightBarClassName =
  'border-t border-white/10 flex flex-col items-center justify-between gap-6 pt-8 md:flex-row';

export const footerSocialIconButtonClassName = [
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
  'border border-white/15 text-white transition hover:border-white/30 hover:bg-white/10',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
  'focus-visible:ring-offset-2 focus-visible:ring-offset-mit-footer',
].join(' ');

export const mitAccentLinkClassName = 'text-sm font-semibold text-primary-ink';

/**
 * “MIT” on auth center chrome: crimson in light; rose ink in dark on page background.
 */
export const siteBrandMitWordmarkDefaultClassName =
  'text-mit-red dark:text-mit-red-ink';

/**
 * @deprecated Prefer [`Button`](src/components/ui/button.tsx) with `variant="default"`.
 */
export const authPrimaryButtonClassName = [
  'rounded-md bg-mit-red px-4 py-2 font-medium text-white',
  'hover:bg-mit-red-hover dark:hover:ring-1 dark:hover:ring-inset dark:hover:ring-white/30 disabled:opacity-60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:ring-offset-background',
].join(' ');

export const authInlineLinkClassName =
  'text-mit-red underline underline-offset-2 hover:text-mit-red-hover dark:text-mit-red-ink focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2 focus-visible:ring-offset-background';

/**
 * Admin catalog status pills (`AdminStatusPill`): `ring-1 ring-inset` chrome;
 * colors from `mit-theme.css` (`mit-success*`, `mit-red*`, shadcn `muted` /
 * `border`), not palette `emerald-*` / `slate-*` / `red-*`.
 */
export const adminStatusPillToneClassName = {
  success: 'bg-mit-success/10 text-mit-success-ink ring-mit-success/30',
  neutral: 'bg-muted text-mit-readable-ink ring-border',
  danger:
    'bg-mit-red-50 text-mit-red-900 ring-mit-red-300 dark:bg-mit-red-950/70 dark:text-mit-red-100 dark:ring-mit-red-700',
} as const;

/** Shared semantics for admin status UI (pills, bordered list badges). */
export type AdminStatusSemanticTone = keyof typeof adminStatusPillToneClassName;

/**
 * Bordered rounded-rect chips for the admin events table; same tones as
 * {@link adminStatusPillToneClassName}, different layout utilities.
 */
export const adminEventListStatusBadgeBaseClassName =
  'inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium';

export const adminEventListStatusBadgeToneClassName: Record<
  AdminStatusSemanticTone,
  string
> = {
  success: 'border-mit-success/30 bg-mit-success/10 text-mit-success-ink',
  danger:
    'border-mit-red-200 bg-mit-red-50 text-mit-red-900 dark:border-mit-red-700 dark:bg-mit-red-950/70 dark:text-mit-red-100',
  neutral: 'border-border bg-muted/60 text-mit-readable-ink',
};

/** Native `<select>` in admin catalog forms (server `FormData`; matches Input chrome). */
export const adminNativeSelectClassName = [
  'flex h-8 w-full cursor-pointer appearance-none rounded-lg border border-input bg-transparent bg-[length:1rem] bg-[right_0.5rem_center] bg-no-repeat px-2.5 py-1 pr-9 text-sm text-foreground outline-none transition-colors',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input-background dark:contrast-more:border-white',
  "bg-[url('data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2371717a%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E')]",
].join(' ');

/** Matches [`Input`](src/components/ui/input.tsx) styling for rare non-`Input` fields. */
export const authInputClassName = [
  'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base text-foreground outline-none transition-colors',
  'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm',
  'dark:bg-input-background dark:contrast-more:border-white',
].join(' ');
