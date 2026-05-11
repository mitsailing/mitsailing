import { siteBrandMitWordmarkDefaultClassName } from '@/lib/mit-sailing/tokens';

const shellClassName =
  'font-mit-serif text-[22px] font-bold tracking-tight text-mit-readable-ink';

const authClassName =
  'font-mit-serif text-[22px] font-bold tracking-tight text-mit-text';

export type SiteBrandWordmarkTypographyProps = {
  mitLabel: string;
  sailingLabel: string;
  /**
   * `shell`: sticky header and mobile menu (sailing inherits `dark:text-white`).
   * `auth`: centered auth column (sailing uses `text-mit-text` / foreground).
   */
  variant: 'auth' | 'shell';
};

/**
 * Shared “MIT Sailing” wordmark typography; “MIT” uses institute red in light and rose ink in dark.
 *
 * @param props - Labels and shell vs auth chrome
 * @returns Wordmark block (not a link)
 */
export function SiteBrandWordmarkTypography(
  props: SiteBrandWordmarkTypographyProps
) {
  const rootClassName =
    props.variant === 'shell' ? shellClassName : authClassName;

  return (
    <div className={rootClassName}>
      <span className={siteBrandMitWordmarkDefaultClassName}>
        {props.mitLabel}
      </span>
      <span className="ml-1">{props.sailingLabel}</span>
    </div>
  );
}
