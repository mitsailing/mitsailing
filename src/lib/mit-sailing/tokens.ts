/**
 * Shell class helpers (`mit-theme.css` owns hex). Use `tokens.colors` only for
 * inline styles / SVG when Tailwind utilities are awkward.
 */
export const tokens = {
  colors: {
    /** Light foreground; matches `:root --foreground` in mit-theme.css. */
    text: '#09090b',
    mitEmailRed: '#8a1538',
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
