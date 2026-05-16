import type {
  PavilionPersonaPriceDisplay,
  PavilionPricingTypeValue,
  PavilionReservableItemPricing,
  PavilionReservableItemSlotPricing,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
} from '@/libs/mit-sailing/pavilionReservationTypes';

const CENTS_PER_DOLLAR = 100;
const MINUTES_PER_HOUR = 60;

const pavilionReservationUsdFormatter = new Intl.NumberFormat('en-US', {
  currency: 'USD',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: 'currency',
});

export function formatPavilionReservationMoney(amountCents: number): string {
  return pavilionReservationUsdFormatter.format(amountCents / CENTS_PER_DOLLAR);
}

export function priceForPersona(
  item: PavilionReservableItemPricing,
  persona: PavilionReservationPersonaValue
): number | null {
  if (item.pricingType === 'tbd') {
    return null;
  }
  return item.prices[persona];
}

export function isPersonaPriceAvailable(
  priceCents: number | null
): priceCents is number {
  return priceCents !== null;
}

function roundPavilionEstimateToWholeDollarsCents(amountCents: number): number {
  return Math.round(amountCents / CENTS_PER_DOLLAR) * CENTS_PER_DOLLAR;
}

function hourlyAmountCents(props: {
  amountCents: number;
  endMinutes: number;
  minDurationHours: number | null;
  startMinutes: number;
}): number {
  const durationMinutes = Math.max(
    props.endMinutes - props.startMinutes,
    (props.minDurationHours ?? 0) * MINUTES_PER_HOUR
  );
  const proratedCents = Math.round(
    (props.amountCents * durationMinutes) / MINUTES_PER_HOUR
  );
  return roundPavilionEstimateToWholeDollarsCents(proratedCents);
}

export function estimatedSlotAmountCents(props: {
  item: PavilionReservableItemSlotPricing;
  persona: PavilionReservationPersonaValue;
  slot: PavilionReservationSlotInput;
  slotIndexForItem: number;
}): number | null {
  const unitPriceCents = priceForPersona(props.item, props.persona);
  if (unitPriceCents === null) {
    return null;
  }

  switch (props.item.pricingType) {
    case 'flat': {
      return props.slotIndexForItem === 0 ? unitPriceCents : 0;
    }
    case 'hourly': {
      return hourlyAmountCents({
        amountCents: unitPriceCents,
        endMinutes: props.slot.endMinutes,
        minDurationHours: props.item.minDurationHours,
        startMinutes: props.slot.startMinutes,
      });
    }
    case 'tbd': {
      return null;
    }
    default: {
      const exhaustivePricingType: never = props.item.pricingType;
      return exhaustivePricingType;
    }
  }
}

export function estimatedServiceAmountCents(props: {
  item: PavilionReservableItemPricing;
  persona: PavilionReservationPersonaValue;
}): number | null {
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

export function personaPriceDisplay(props: {
  item: PavilionReservableItemPricing;
  persona: PavilionReservationPersonaValue;
  tbdLabel: string;
}): PavilionPersonaPriceDisplay {
  const priceCents = priceForPersona(props.item, props.persona);
  return {
    available: isPersonaPriceAvailable(priceCents),
    label: priceLabel({
      amountCents: priceCents,
      pricingType: props.item.pricingType,
      tbdLabel: props.tbdLabel,
    }),
    priceCents,
  };
}

export function priceLabelForPersona(props: {
  item: PavilionReservableItemPricing;
  persona: PavilionReservationPersonaValue;
  tbdLabel: string;
}): string {
  return personaPriceDisplay(props).label;
}
