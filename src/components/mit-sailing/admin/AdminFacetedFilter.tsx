'use client';

import { Check, PlusCircle } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type AdminFacetedFilterOption = {
  label: string;
  value: string;
};

type AdminFacetedFilterProps = {
  defaultValue: string;
  emptyLabel?: string;
  label: string;
  onSelect: (value: string) => void;
  options: AdminFacetedFilterOption[];
  value: string;
};

/**
 * Compact tablecn-style single-select faceted filter with controlled popover.
 *
 * @param props - Filter label, options, and selection handler
 * @returns Faceted filter popover trigger
 */
export function AdminFacetedFilter(props: AdminFacetedFilterProps) {
  const [open, setOpen] = useState(false);
  const selectedOption = props.options.find(
    (option) => option.value === props.value
  );
  const isActive = props.value !== props.defaultValue;

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          className={cn('h-8 border-dashed', isActive && 'border-solid')}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlusCircle aria-hidden className="size-4" />
          {props.label}
          {isActive && selectedOption ? (
            <>
              <span aria-hidden className="text-muted-foreground">
                ·
              </span>
              <Badge
                className="rounded-sm px-1 font-normal"
                variant="secondary"
              >
                {selectedOption.label}
              </Badge>
            </>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder={props.label} />
          <CommandList>
            <CommandEmpty>
              {props.emptyLabel ?? 'No results found.'}
            </CommandEmpty>
            <CommandGroup>
              {props.options.map((option) => {
                const isSelected = option.value === props.value;
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      setOpen(false);
                      props.onSelect(option.value);
                    }}
                    value={option.label}
                  >
                    <Check
                      aria-hidden
                      className={cn(
                        'size-4 shrink-0',
                        isSelected ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
