import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type DonationFundCardProps = {
  name: string;
  description: string;
  fundNumberLabel: string;
  giveLabel: string;
  url: string;
  className?: string;
};

/**
 * Single fund row: title, designation badge, description, and external Give CTA.
 *
 * @param props - Row props (fund copy and external giving URL).
 * @returns Article element for one fund.
 */
export function DonationFundCard(props: DonationFundCardProps) {
  return (
    <article
      className={cn(
        'rounded-xl border border-mit-line bg-card p-5 transition-colors hover:border-mit-red/30 sm:p-6',
        props.className
      )}
    >
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 font-mit-serif text-lg font-semibold text-mit-text">
            {props.name}
          </h3>
          <span className="mb-4 inline-block rounded-md bg-muted px-3 py-1 text-sm font-medium text-mit-text">
            {props.fundNumberLabel}
          </span>
          <p className="max-w-3xl text-base leading-relaxed text-mit-text">
            {props.description}
          </p>
        </div>
        <div className="mt-4 shrink-0 md:mt-0 md:ml-4">
          <Button
            className="w-full px-5 md:w-auto"
            size="lg"
            variant="default"
            asChild
          >
            <a href={props.url} target="_blank" rel="noopener noreferrer">
              {props.giveLabel}
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}
