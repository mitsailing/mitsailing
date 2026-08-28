'use client';

import Image from 'next/image';
import type { PavilionReservableItemMediaDto } from '@/libs/mit-sailing/pavilionReservationTypes';

type PavilionSpaceGalleryProps = {
  readonly alt: string;
  readonly media: readonly PavilionReservableItemMediaDto[];
};

/**
 * Shared photo/video gallery for /reserve overlays and /spaces/[slug].
 *
 * @param props - Gallery props
 * @returns Media grid or null when empty
 */
export function PavilionSpaceGallery(props: PavilionSpaceGalleryProps) {
  if (props.media.length === 0) {
    return null;
  }

  return (
    <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
      {props.media.map((item) => (
        <li
          className="overflow-hidden rounded-lg border border-mit-line bg-mit-surface"
          key={item.id}
        >
          {item.mediaKind === 'video' ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- staff venue clips; optional caption text shown below when present
            <video
              aria-label={item.caption ?? props.alt}
              className="aspect-video w-full object-cover"
              controls
              playsInline
              preload="metadata"
              src={item.publicPath}
            />
          ) : (
            <div className="relative aspect-video w-full">
              <Image
                alt={item.caption ?? props.alt}
                className="object-cover"
                fill
                sizes="(min-width: 768px) 50vw, 100vw"
                src={item.publicPath}
              />
            </div>
          )}
          {item.caption ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              {item.caption}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
