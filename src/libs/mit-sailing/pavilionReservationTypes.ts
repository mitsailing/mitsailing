import type { PavilionReservationPriceMap } from '@/libs/mit-sailing/pavilionReservationPersonas';

export type {
  PavilionReservationPersonaValue,
  PavilionReservationPriceMap,
} from '@/libs/mit-sailing/pavilionReservationPersonas';

export type PavilionReservationStatusValue =
  | 'pending'
  | 'needs_info'
  | 'approved'
  | 'declined'
  | 'cancelled'
  | 'draft';

export type PavilionReservationPaymentStatusValue =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'waived';

export type PavilionPricingTypeValue = 'hourly' | 'flat';

export type PavilionReservableItemKindValue = 'space' | 'service';

type PavilionReservableItemPublicGroupValue =
  | 'venue'
  | 'event_options'
  | 'programs';

export type PavilionReservableItemMediaDto = {
  id: string;
  publicPath: string;
  mediaKind: 'image' | 'video' | 'file';
  caption: string | null;
  displayOrder: number;
};

export type PavilionReservableItemDto = {
  id: string;
  slug: string;
  kind: PavilionReservableItemKindValue;
  name: string;
  description: string;
  imageUrl: string | null;
  pricingType: PavilionPricingTypeValue;
  minDurationHours: number | null;
  publicGroup: PavilionReservableItemPublicGroupValue | null;
  displayOrder: number;
  prices: PavilionReservationPriceMap;
  media: PavilionReservableItemMediaDto[];
};

/** Persona price map and pricing mode (`null` = price on request, `0` = complimentary). */
export type PavilionReservableItemPricing = Pick<
  PavilionReservableItemDto,
  'prices' | 'pricingType'
>;

/** Fields required to estimate space slot totals. */
export type PavilionReservableItemSlotPricing = Pick<
  PavilionReservableItemDto,
  'minDurationHours' | 'prices' | 'pricingType'
>;

/** Resolved persona quote for catalog UI (null = price on request, zero = complimentary). */
export type PavilionPersonaPriceDisplay = {
  available: boolean;
  label: string;
  priceCents: number | null;
};

export type PavilionReservationSlotInput = {
  itemId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

export type PavilionReservationErrorKey =
  | 'error_catalog'
  | 'error_notice'
  | 'error_rate_limited'
  | 'error_unknown'
  | 'error_validation';

export type PavilionReservationSubmitState = {
  status: 'idle' | 'confirmed' | 'error';
  referenceCode?: string;
  errors: PavilionReservationErrorKey[];
};
