import type { LucideIcon } from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DonationSupportOptionProps = {
  icon: LucideIcon;
  title: string;
  body: string;
  linkLabel: string;
  linkHref: string;
  /** When true, link opens in a new tab (external URLs). */
  linkExternal?: boolean;
  className?: string;
};

/**
 * Icon + title + body + text link for secondary donate-page callouts (mailing list, volunteer, etc.).
 *
 * @param props - Callout content and link target.
 * @returns Layout row with icon well and link-styled CTA.
 */
export function DonationSupportOption(props: DonationSupportOptionProps) {
  const Icon = props.icon;
  const external = props.linkExternal ?? false;
  return (
    <div className={cn('flex items-start gap-4', props.className)}>
      <div className="rounded-full border border-mit-line bg-card p-2.5 text-mit-text">
        <Icon className="size-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <h3 className="mb-1 font-mit-serif text-lg font-semibold text-mit-text">
          {props.title}
        </h3>
        <p className="mb-3 text-sm leading-relaxed text-mit-text">
          {props.body}
        </p>
        <Button
          variant="link"
          className="h-auto gap-0 p-0 text-sm font-semibold"
          asChild
        >
          <a
            href={props.linkHref}
            {...(external
              ? { target: '_blank', rel: 'noopener noreferrer' }
              : undefined)}
          >
            {props.linkLabel}
            <ArrowRight className="ml-1 size-4" aria-hidden />
          </a>
        </Button>
      </div>
    </div>
  );
}
