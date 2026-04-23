/**
 * Class-only utilities for the MIT Sailing public shell. Palette + fonts live in
 * `src/styles/mit-theme.css` under `@theme inline` (`text-mit-text`, `bg-mit-red`, `font-mit-serif`, …).
 */
export const textFocusRingClassName =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2';

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

/** In-content red links (sidebar events, “View all”, class CTAs). */
export const mitAccentLinkClassName = 'text-sm font-semibold text-mit-red';

/** Primary submit buttons on auth forms (login, signup, password reset). */
export const authPrimaryButtonClassName = [
  'rounded-md bg-mit-red px-4 py-2 font-medium text-white',
  'hover:bg-mit-red-hover disabled:opacity-60',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2',
].join(' ');

/** Inline text links on auth pages (forgot password, sign up, etc.). */
export const authInlineLinkClassName =
  'text-mit-red underline underline-offset-2 hover:text-mit-red-hover focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mit-text focus-visible:ring-offset-2';

/** Standard bordered inputs on auth flows (matches shell neutrals). */
export const authInputClassName =
  'rounded-md border border-mit-line bg-white px-3 py-2 text-mit-text outline-none focus:ring-2 focus:ring-mit-text';
