export type PavilionReservationPersonaValue =
  | 'mit_academic'
  | 'mit_student'
  | 'mit_community'
  | 'non_mit';

export type PavilionReservationStatusValue =
  | 'pending'
  | 'approved'
  | 'declined'
  | 'cancelled';

export type PavilionPricingTypeValue = 'hourly' | 'flat' | 'tbd';

export type PavilionReservableItemKindValue = 'space' | 'service';

export type PavilionReservationPriceMap = Record<
  PavilionReservationPersonaValue,
  number | null
>;

export type PavilionReservableItemDto = {
  id: string;
  slug: string;
  kind: PavilionReservableItemKindValue;
  name: string;
  description: string;
  imageUrl: string | null;
  pricingType: PavilionPricingTypeValue;
  minDurationHours: number | null;
  displayOrder: number;
  prices: PavilionReservationPriceMap;
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
