'use client';

import { XIcon } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function Dialog(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger(
  props: React.ComponentProps<typeof DialogPrimitive.Trigger>
) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal(
  props: React.ComponentProps<typeof DialogPrimitive.Portal>
) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose(
  props: React.ComponentProps<typeof DialogPrimitive.Close>
) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay(
  props: React.ComponentProps<typeof DialogPrimitive.Overlay>
) {
  return (
    <DialogPrimitive.Overlay
      {...props}
      data-slot="dialog-overlay"
      className={cn(
        'fixed inset-0 isolate z-50 bg-black/60 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
        props.className
      )}
    />
  );
}

type DialogContentProps = React.ComponentProps<typeof DialogPrimitive.Content> &
  (
    | {
        readonly closeLabel: string;
        readonly showCloseButton?: true;
      }
    | {
        readonly closeLabel?: string;
        readonly showCloseButton: false;
      }
  );

function DialogContent(props: DialogContentProps) {
  const { closeLabel, showCloseButton, ...contentProps } = props;
  const shouldShowCloseButton = showCloseButton ?? true;

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        {...contentProps}
        data-slot="dialog-content"
        className={cn(
          'fixed top-1/2 left-1/2 z-50 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
          props.className
        )}
      >
        {props.children}
        {shouldShowCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              className="absolute top-2 right-2"
              size="icon-sm"
              type="button"
            >
              <XIcon />
              <span className="sr-only">{closeLabel}</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogTitle(
  props: React.ComponentProps<typeof DialogPrimitive.Title>
) {
  return (
    <DialogPrimitive.Title
      {...props}
      data-slot="dialog-title"
      className={cn('text-base leading-none font-medium', props.className)}
    />
  );
}

export { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger };
