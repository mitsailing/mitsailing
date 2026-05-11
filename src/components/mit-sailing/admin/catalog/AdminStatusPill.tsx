import type { AdminStatusSemanticTone } from '@/lib/mit-sailing/tokens';
import { adminStatusPillToneClassName } from '@/lib/mit-sailing/tokens';
import { cn } from '@/lib/utils';

/** Visual tone for catalog status pills (Live/Draft, Yes/No, banned). */
export type AdminStatusPillTone = AdminStatusSemanticTone;

/** List rows use compact padding; edit headings use comfortable padding. */
export type AdminStatusPillDensity = 'compact' | 'comfortable';

type AdminStatusPillProps = {
  children: React.ReactNode;
  tone: AdminStatusPillTone;
  /** Defaults to `compact` (table cells). */
  density?: AdminStatusPillDensity;
  className?: string;
};

const densityClassName: Record<AdminStatusPillDensity, string> = {
  compact: 'px-2 py-0.5 text-xs font-medium',
  comfortable: 'px-2.5 py-1 text-xs font-semibold',
};

/**
 * Rounded status pill for admin catalog tables and edit headers (Live/Draft,
 * boolean columns, banned). Tones use ring-inset for alignment with donation
 * fund status styling.
 *
 * @param props - Label, tone, optional density override
 * @returns Inline pill span
 */
export function AdminStatusPill(props: AdminStatusPillProps) {
  const density = props.density ?? 'compact';
  return (
    <span
      className={cn(
        'inline-flex rounded-full ring-1 ring-inset',
        adminStatusPillToneClassName[props.tone],
        densityClassName[density],
        props.className
      )}
    >
      {props.children}
    </span>
  );
}
