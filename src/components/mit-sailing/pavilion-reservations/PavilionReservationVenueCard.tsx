'use client';

import { useTranslations } from 'next-intl';
import type * as React from 'react';
import { useState } from 'react';
import { PavilionReservationListingMedia } from '@/components/mit-sailing/pavilion-reservations/PavilionReservationListingMedia';
import { PavilionSpaceGallery } from '@/components/mit-sailing/pavilion-reservations/PavilionSpaceGallery';
import { SiteModalContent } from '@/components/mit-sailing/site/SiteModal';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  formatPavilionReservationMoney,
  personaPriceDisplay,
  priceForPersona,
} from '@/libs/mit-sailing/pavilionReservationPricing';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
} from '@/libs/mit-sailing/pavilionReservationTypes';
import {
  pavilionReservationVenueShareHash,
  sharePavilionReservationVenue,
} from '@/libs/mit-sailing/pavilionReservationVenueShare';

async function copyPavilionVenueShareText(text: string) {
  await navigator.clipboard.writeText(text);
}

const VENUE_CAPACITY_BY_SLUG: Readonly<Record<string, number>> = {
  casual_dock: 50,
  roof_deck: 100,
};

function venueCardBlurb(props: {
  description: string;
  dockBlurb: string;
  roofBlurb: string;
  slug: string;
}) {
  if (props.slug === 'casual_dock') {
    return props.dockBlurb;
  }
  if (props.slug === 'roof_deck') {
    return props.roofBlurb;
  }
  return props.description;
}

/**
 * Listing card for an hourly pavilion venue: photo strip, Select, and share.
 *
 * @param props - Venue, persona, editor, and request-line handlers
 * @returns Venue article with media strip and select action
 */
export function PavilionReservationVenueCard(props: {
  afterHoursItems: PavilionReservableItemDto[];
  bookedCount: number;
  children?: React.ReactNode;
  editing: boolean;
  onSelect: () => void;
  onShareResult: (message: string) => void;
  persona: PavilionReservationPersonaValue;
  space: PavilionReservableItemDto;
}) {
  const t = useTranslations('PavilionReservationPage');
  const [galleryOpen, setGalleryOpen] = useState(false);
  const priceDisplay = personaPriceDisplay({
    item: props.space,
    onRequestLabel: t('price_on_request'),
    persona: props.persona,
  });
  const capacity = VENUE_CAPACITY_BY_SLUG[props.space.slug] ?? null;
  const after10 = props.afterHoursItems.find(
    (item) => item.slug === 'after_10'
  );
  const after2 = props.afterHoursItems.find(
    (item) => item.slug === 'after_midnight'
  );
  const after10Cents = after10 ? priceForPersona(after10, props.persona) : null;
  const after2Cents = after2 ? priceForPersona(after2, props.persona) : null;
  const academic = props.persona === 'mit_academic';
  const hashId = pavilionReservationVenueShareHash(props.space.slug);
  const selectLabel =
    props.bookedCount > 0
      ? t('action_add_another_date')
      : t('action_select_venue');
  const selectAria =
    props.bookedCount > 0
      ? t('add_another_date_aria', { name: props.space.name })
      : t('select_venue_aria', { name: props.space.name });
  const hasGallery = props.space.media.length > 0;

  const shareVenue = async () => {
    const pageUrl = `${window.location.origin}${window.location.pathname}`;
    const result = await sharePavilionReservationVenue({
      copyText: copyPavilionVenueShareText,
      pageUrl,
      share:
        typeof navigator.share === 'function'
          ? async (data) => {
              await navigator.share(data);
            }
          : undefined,
      slug: props.space.slug,
      text: t('share_text', {
        description: props.space.description,
        name: props.space.name,
      }),
      title: t('share_title', { name: props.space.name }),
    });
    if (result === 'shared') {
      props.onShareResult(t('share_shared'));
      return;
    }
    if (result === 'copied') {
      props.onShareResult(t('share_copied'));
    }
  };

  return (
    <article
      className="overflow-hidden rounded-[10px] border border-mit-line bg-card transition-colors focus-within:border-mit-red/40 hover:border-mit-red/40"
      data-venue={props.space.slug}
      id={hashId}
    >
      <PavilionReservationListingMedia
        alt={props.space.name}
        fallbackImageUrl={props.space.imageUrl}
        media={props.space.media}
        shareLabel={t('share_venue_label', { name: props.space.name })}
        spaceSlug={props.space.slug}
        onOpen={() => {
          if (hasGallery) {
            setGalleryOpen(true);
          }
        }}
        onShare={() => {
          // eslint-disable-next-line promise/prefer-await-to-then -- click handler cannot await share
          shareVenue().catch(() => {
            /* Web Share abort is not a card error */
          });
        }}
      />
      <div
        className={cn(
          'grid gap-3 p-4',
          'sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start'
        )}
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-mit-text">
            {props.space.name}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {capacity === null
              ? t('venue_rate_only', { rate: priceDisplay.label })
              : t('venue_capacity_rate', {
                  capacity,
                  rate: priceDisplay.label,
                })}
          </p>
          <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">
            {venueCardBlurb({
              description: props.space.description,
              dockBlurb: t('venue_blurb_casual_dock'),
              roofBlurb: t('venue_blurb_roof_deck'),
              slug: props.space.slug,
            })}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {academic || after10Cents === null
              ? t('venue_academic_close')
              : t('venue_after_sunset_fees', {
                  after10: formatPavilionReservationMoney(after10Cents),
                  after2:
                    after2Cents === null
                      ? t('price_on_request')
                      : formatPavilionReservationMoney(after2Cents),
                })}
          </p>
          {props.bookedCount > 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {t('venue_bookings_on_request', { count: props.bookedCount })}
            </p>
          ) : null}
          {hasGallery ? (
            <Dialog
              open={galleryOpen}
              onOpenChange={(open) => {
                setGalleryOpen(open);
              }}
            >
              <DialogTrigger asChild>
                <button
                  className="mt-2 text-xs font-semibold text-mit-red underline-offset-2 hover:underline dark:text-mit-red-ink"
                  type="button"
                >
                  {t('venue_see_photos')}
                </button>
              </DialogTrigger>
              <SiteModalContent
                closeLabel={t('space_details_close')}
                title={props.space.name}
              >
                <PavilionSpaceGallery
                  alt={props.space.name}
                  media={props.space.media}
                />
              </SiteModalContent>
            </Dialog>
          ) : null}
        </div>
        {props.editing ? null : (
          <div className="w-full sm:w-[9.5rem]">
            <Button
              aria-label={selectAria}
              className="h-11 w-full"
              type="button"
              variant="outline"
              onClick={props.onSelect}
            >
              {selectLabel}
            </Button>
          </div>
        )}
      </div>
      {props.children}
    </article>
  );
}
