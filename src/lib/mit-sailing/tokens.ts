import type { CSSProperties } from 'react';

export const tokens = {
  colors: {
    mitRed: '#A31F34',
    mitRedHover: '#8A1A2C',
    mitRedHighlight: '#FEF2F2',
    text: '#2D2D2D',
    surface: '#F5F5F5',
    border: '#E5E5E5',
    success: '#16A34A',
    white: '#FFFFFF',
    footerBackground: '#1A1B1E',
    footerText: '#FFFFFF',
  },
  typography: {
    fontSerif: '"Fraunces", Georgia, serif',
    fontSans: '"Inter", system-ui, -apple-system, sans-serif',
    display: '36px',
    heading: '22px',
    body: '16px',
    small: '14px',
    caption: '12px',
  },
} as const;

export const footerHorizontalRuleClassName = 'h-px flex-1 bg-white/20';

export const footerNavSectionHeadingStyle: CSSProperties = {
  fontSize: tokens.typography.caption,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: tokens.colors.footerText,
};

export const footerSocialGroupLabelStyle: CSSProperties = {
  fontFamily: tokens.typography.fontSans,
  fontSize: tokens.typography.small,
  fontWeight: 600,
  letterSpacing: '-0.01em',
  color: tokens.colors.footerText,
};

export const footerNavLinkStyle: CSSProperties = {
  fontSize: tokens.typography.small,
  color: tokens.colors.footerText,
};

export const footerLegalLinkStyle: CSSProperties = {
  fontSize: tokens.typography.caption,
  color: tokens.colors.footerText,
};

export const footerCopyrightBarStyle: CSSProperties = {
  borderTop: '1px solid rgba(255,255,255,0.1)',
};

export const textFocusRingClassName =
  'rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#2D2D2D]';

export const footerLinkClassName =
  'underline-offset-4 hover:underline focus-visible:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white rounded-sm';

export const footerSocialIconButtonClassName = [
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
  'border border-white/15 text-white transition hover:bg-white/10 hover:border-white/30',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
  'focus-visible:ring-offset-2',
  `focus-visible:ring-offset-[${tokens.colors.footerBackground}]`,
].join(' ');
