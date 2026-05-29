'use client';

import { X } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type SiteModalContentProps = {
  readonly bodyClassName?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly closeLabel: string;
  readonly descriptionId?: string;
  readonly eyebrow?: React.ReactNode;
  readonly title: React.ReactNode;
};

export function SiteModalContent(props: SiteModalContentProps) {
  return (
    <DialogContent
      aria-describedby={props.descriptionId}
      className={cn(
        'grid max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-lg border border-mit-line bg-background p-0 text-mit-text shadow-2xl ring-1 ring-mit-line sm:w-full',
        props.className
      )}
      showCloseButton={false}
    >
      <div className="flex items-start justify-between gap-4 border-b border-mit-line bg-background px-5 py-4 sm:px-6">
        <div className="min-w-0">
          {props.eyebrow ? (
            <p className="mb-1 text-xs font-semibold tracking-normal text-primary-ink">
              {props.eyebrow}
            </p>
          ) : null}
          <DialogTitle className="font-mit-serif text-2xl leading-tight font-semibold text-balance text-mit-text">
            {props.title}
          </DialogTitle>
        </div>
        <DialogClose asChild>
          <Button
            aria-label={props.closeLabel}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X aria-hidden className="size-5" />
          </Button>
        </DialogClose>
      </div>
      <div
        className={cn(
          'flex min-h-0 flex-col gap-5 overflow-y-auto bg-muted/35 px-5 py-5 sm:px-6',
          props.bodyClassName
        )}
      >
        {props.children}
      </div>
    </DialogContent>
  );
}
