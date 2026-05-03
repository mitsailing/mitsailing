import type { ReactElement, ReactNode } from 'react';

export type ProfileBannerState = {
  kind: 'success' | 'error';
  message: ReactNode;
} | null;

/**
 * Renders an inline success or error line for profile forms.
 *
 * @param props - Banner state
 * @returns Paragraph or null
 */
export function ProfileInlineBanner(props: {
  banner: ProfileBannerState;
}): ReactElement | null {
  if (!props.banner) {
    return null;
  }
  const cls =
    props.banner.kind === 'success'
      ? 'mt-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800'
      : 'mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800';
  return (
    <p
      className={cls}
      role={props.banner.kind === 'error' ? 'alert' : undefined}
    >
      {props.banner.message}
    </p>
  );
}
