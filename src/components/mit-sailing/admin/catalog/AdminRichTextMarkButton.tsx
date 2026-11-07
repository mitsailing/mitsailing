'use client';

import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Compact toolbar toggle used by CMS and news TipTap editors.
 *
 * @param props - Label, active state, and click handler for one mark control
 * @returns Icon button wired for a rich-text toolbar
 */
export function AdminRichTextMarkButton(props: {
  active?: boolean;
  disabled: boolean;
  Icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={props.label}
      aria-pressed={props.active}
      disabled={props.disabled}
      onClick={props.onClick}
      size="icon"
      title={props.label}
      type="button"
      variant={props.active ? 'secondary' : 'ghost'}
    >
      <props.Icon aria-hidden />
    </Button>
  );
}
