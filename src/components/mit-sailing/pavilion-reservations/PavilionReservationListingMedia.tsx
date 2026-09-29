'use client';

import { ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { PavilionReservableItemMediaDto } from '@/libs/mit-sailing/pavilionReservationTypes';

type ListingSlide = {
  id: string;
  kind: 'empty' | 'image' | 'video';
  src: string | null;
  title: string;
};

function listingSlides(props: {
  fallbackImageUrl: string | null;
  media: readonly PavilionReservableItemMediaDto[];
}): ListingSlide[] {
  if (props.media.length > 0) {
    return props.media.map((item) => ({
      id: item.id,
      kind: item.mediaKind === 'video' ? 'video' : 'image',
      src: item.publicPath,
      title: item.caption ?? '',
    }));
  }
  if (props.fallbackImageUrl) {
    return [
      {
        id: 'cover',
        kind: 'image',
        src: props.fallbackImageUrl,
        title: '',
      },
    ];
  }
  return [
    {
      id: 'placeholder',
      kind: 'empty',
      src: null,
      title: '',
    },
  ];
}

/**
 * Airbnb-scale photo strip for a pavilion venue card: fixed-height full-bleed
 * media, prev/next, n/m, share on the photo.
 *
 * @param props - Venue media, share, and gallery open handlers
 * @returns Photo strip controls
 */
export function PavilionReservationListingMedia(props: {
  alt: string;
  fallbackImageUrl: string | null;
  media: readonly PavilionReservableItemMediaDto[];
  onOpen: (mediaId: string | null) => void;
  onShare: () => void;
  shareLabel: string;
  spaceSlug: string;
}) {
  const t = useTranslations('PavilionReservationPage');
  const slides = listingSlides({
    fallbackImageUrl: props.fallbackImageUrl,
    media: props.media,
  });
  const [index, setIndex] = useState(0);
  const [pointerStartX, setPointerStartX] = useState<number | null>(null);
  const suppressSlideClickRef = useRef(false);
  const total = slides.length;
  const safeIndex = ((index % total) + total) % total;
  const slide = slides[safeIndex] ?? slides[0];
  if (!slide) {
    return null;
  }

  const step = (delta: number) => {
    setIndex((current) => current + delta);
  };
  const caption =
    slide.title.trim() !== '' && slide.title !== props.alt ? slide.title : '';

  return (
    <fieldset
      aria-label={t('venue_photos_aria', { name: props.alt })}
      className={cn(
        'relative isolate h-[11.5rem] overflow-hidden border-0 p-0 sm:h-[13.5rem] lg:h-[14.5rem]',
        props.spaceSlug === 'roof_deck'
          ? 'bg-gradient-to-br from-mit-red/50 via-muted-foreground/40 to-mit-line'
          : 'bg-gradient-to-br from-mit-red/30 via-muted to-mit-line'
      )}
      onPointerDown={(event) => {
        if (
          event.target instanceof Element &&
          event.target.closest('[data-media-control]')
        ) {
          return;
        }
        setPointerStartX(event.clientX);
      }}
      onPointerUp={(event) => {
        if (pointerStartX === null) {
          return;
        }
        const dx = event.clientX - pointerStartX;
        setPointerStartX(null);
        if (Math.abs(dx) < 48) {
          return;
        }
        suppressSlideClickRef.current = true;
        step(dx < 0 ? 1 : -1);
      }}
    >
      <legend className="sr-only">
        {t('venue_photos_aria', { name: props.alt })}
      </legend>
      <button
        aria-label={
          slide.kind === 'video'
            ? t('venue_open_video', {
                current: safeIndex + 1,
                total,
                title: caption || props.alt,
              })
            : t('venue_open_photo', {
                current: safeIndex + 1,
                total,
                title: caption || props.alt,
              })
        }
        className="absolute inset-0 block size-full overflow-hidden p-0"
        type="button"
        onClick={() => {
          if (suppressSlideClickRef.current) {
            suppressSlideClickRef.current = false;
            return;
          }
          props.onOpen(slide.id === 'placeholder' ? null : slide.id);
        }}
      >
        {slide.kind === 'image' && slide.src ? (
          <Image
            alt=""
            className="object-cover"
            fill
            sizes="(max-width: 640px) 100vw, 28rem"
            src={slide.src}
            unoptimized={
              slide.src.startsWith('/') && !slide.src.startsWith('//')
            }
          />
        ) : null}
        {slide.kind === 'video' && slide.src ? (
          <video
            aria-hidden
            className="size-full object-cover"
            muted
            playsInline
            preload="metadata"
            src={slide.src}
          />
        ) : null}
        {slide.kind === 'video' ? (
          <span className="absolute top-2 left-2 grid size-6 place-items-center rounded-full bg-mit-red text-[0.65rem] text-white">
            ▶
          </span>
        ) : null}
      </button>
      <div className="pointer-events-none absolute inset-0 z-2">
        <button
          aria-label={props.shareLabel}
          className="pointer-events-auto absolute top-2 right-2 grid size-9 place-items-center rounded-full bg-card/95 text-mit-text shadow-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-mit-red"
          data-media-control=""
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            props.onShare();
          }}
        >
          <Share2 aria-hidden className="size-4" />
        </button>
        {total > 1 ? (
          <>
            <button
              aria-label={t('venue_photo_prev')}
              className="pointer-events-auto absolute top-1/2 left-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-card/95 text-mit-text shadow-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-mit-red"
              data-media-control=""
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(-1);
              }}
            >
              <ChevronLeft aria-hidden className="size-4" />
            </button>
            <button
              aria-label={t('venue_photo_next')}
              className="pointer-events-auto absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-full bg-card/95 text-mit-text shadow-sm hover:bg-card focus-visible:ring-2 focus-visible:ring-mit-red"
              data-media-control=""
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                step(1);
              }}
            >
              <ChevronRight aria-hidden className="size-4" />
            </button>
          </>
        ) : null}
        {total > 1 || caption ? (
          <div
            aria-live="polite"
            className="absolute bottom-2 left-1/2 flex max-w-[calc(100%-5.5rem)] -translate-x-1/2 items-center gap-2 overflow-hidden rounded-full bg-mit-text/70 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white"
          >
            <span className="tabular-nums opacity-90">
              {t('venue_media_count', {
                current: safeIndex + 1,
                total,
              })}
            </span>
            {caption ? (
              <span className="max-w-28 truncate sm:max-w-44">{caption}</span>
            ) : null}
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
