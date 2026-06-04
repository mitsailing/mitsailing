import type * as React from 'react';

export type ProfileBannerState = {
  kind: 'success' | 'error';
  message: React.ReactNode;
} | null;

/**
 * Renders an inline success or error line for profile forms.
 *
 * @param props - Banner state
 * @returns Paragraph or null
 */
export function ProfileInlineBanner(props: { banner: ProfileBannerState }) {
  if (!props.banner) {
    return null;
  }
  const cls =
    props.banner.kind === 'success'
      ? 'mt-2 rounded-md border border-green-700/30 bg-green-50 px-3 py-2 text-sm font-medium text-green-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:bg-green-950/30 dark:text-green-100'
      : 'mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm font-medium text-red-900 motion-safe:animate-in motion-safe:duration-150 motion-safe:fade-in-0 motion-reduce:animate-none dark:text-red-100';
  return (
    <p
      className={cls}
      role={props.banner.kind === 'error' ? 'alert' : 'status'}
    >
      {props.banner.message}
    </p>
  );
}
