import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AdminFilterChip } from '@/libs/admin/adminFilterChip';
import { Link } from '@/libs/I18nNavigation';

type AdminActiveFilterChipsProps = {
  readonly chips: AdminFilterChip[];
  readonly clearHref?: string;
  readonly clearLabel?: string;
};

/**
 * Renders removable active filter chips and an optional reset-all control.
 *
 * @param props - Chip descriptors and clear action
 * @returns Chip row markup or null when empty
 */
export function AdminActiveFilterChips(props: AdminActiveFilterChipsProps) {
  if (props.chips.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {props.chips.map((chip) => (
        <Badge
          className="gap-1 pr-1 font-normal"
          key={chip.key}
          variant="secondary"
        >
          <span>
            {chip.label}: {chip.valueLabel}
          </span>
          <Link
            aria-label={chip.removeAriaLabel}
            className="rounded-sm p-0.5 text-muted-foreground no-underline hover:bg-muted hover:text-foreground"
            href={chip.removeHref}
          >
            <X aria-hidden className="size-3.5" />
          </Link>
        </Badge>
      ))}
      {props.clearHref && props.clearLabel ? (
        <Button asChild className="h-7 px-2" size="sm" variant="ghost">
          <Link href={props.clearHref}>{props.clearLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
