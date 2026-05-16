import type {
  PavilionPricingTypeValue,
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export const PAVILION_RESERVATION_PERSONAS = [
  'mit_academic',
  'mit_student',
  'mit_community',
  'non_mit',
] as const satisfies readonly PavilionReservationPersonaValue[];

export function formatPavilionReservationMoney(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    currency: 'USD',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
    style: 'currency',
  }).format(amountCents / 100);
}

export function priceForPersona(
  item: Pick<PavilionReservableItemDto, 'prices'>,
  persona: PavilionReservationPersonaValue
): number | null {
  return item.prices[persona];
}

function hourlyAmountCents(props: {
  amountCents: number;
  endMinutes: number;
  minDurationHours: number | null;
  startMinutes: number;
}): number {
  const durationMinutes = Math.max(
    props.endMinutes - props.startMinutes,
    (props.minDurationHours ?? 0) * 60
  );
  const proratedCents = Math.round((props.amountCents * durationMinutes) / 60);
  return Math.round(proratedCents / 100) * 100;
}

export function estimatedSlotAmountCents(props: {
  item: Pick<
    PavilionReservableItemDto,
    'id' | 'minDurationHours' | 'prices' | 'pricingType'
  >;
  persona: PavilionReservationPersonaValue;
  slot: PavilionReservationSlotInput;
  slotIndexForItem: number;
}): number | null {
  const price = priceForPersona(props.item, props.persona);
  if (price === null || props.item.pricingType === 'tbd') {
    return null;
  }
  if (props.item.pricingType === 'flat') {
    return props.slotIndexForItem === 0 ? price : 0;
  }
  return hourlyAmountCents({
    amountCents: price,
    endMinutes: props.slot.endMinutes,
    minDurationHours: props.item.minDurationHours,
    startMinutes: props.slot.startMinutes,
  });
}

export function estimatedServiceAmountCents(props: {
  item: Pick<PavilionReservableItemDto, 'prices' | 'pricingType'>;
  persona: PavilionReservationPersonaValue;
}): number | null {
  if (props.item.pricingType === 'tbd') {
    return null;
  }
  return priceForPersona(props.item, props.persona);
}

export function priceLabel(props: {
  amountCents: number | null;
  pricingType: PavilionPricingTypeValue;
  tbdLabel: string;
}): string {
  if (props.amountCents === null || props.pricingType === 'tbd') {
    return props.tbdLabel;
  }
  const formatted = formatPavilionReservationMoney(props.amountCents);
  return props.pricingType === 'hourly' ? `${formatted}/hour` : formatted;
}
