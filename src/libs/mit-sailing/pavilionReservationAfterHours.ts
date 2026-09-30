import { priceForPersona } from '@/libs/mit-sailing/pavilionReservationPricing';
import type {
  PavilionReservableItemDto,
  PavilionReservationPersonaValue,
  PavilionReservationSlotInput,
} from '@/libs/mit-sailing/pavilionReservationTypes';

/** Fixture sunset (7:00 PM) until real sunset is wired per date. */
const PAVILION_FIXTURE_SUNSET_MINUTES = 19 * 60;
const AFTER_CLOSE_THROUGH_10PM_MINUTES = 22 * 60;

type PavilionAfterHoursBandKey = 'after_10' | 'after_midnight';

export type PavilionAfterHoursBand = {
  amountCents: number;
  key: PavilionAfterHoursBandKey;
  labelKey: 'after_hours_through_10pm' | 'after_hours_through_2am';
};

/**
 * Fixture sunset minutes for a request date.
 *
 * @param _dateIso - Request calendar date (unused until real sunset is wired)
 * @returns Minutes from midnight for regular close
 */
export function pavilionReservationSunsetMinutes(_dateIso: string) {
  return PAVILION_FIXTURE_SUNSET_MINUTES;
}

/**
 * Resolves the single after-hours fee band for an hourly end time.
 * Academic personas never receive after-hours fees. Bands replace; they never stack.
 *
 * @param props - End time, sunset, persona, and after-hours catalog rows
 * @returns Matching after-hours band, or null when none applies
 */
export function pavilionAfterHoursBandForEnd(props: {
  afterHoursItems: readonly PavilionReservableItemDto[];
  endMinutes: number;
  persona: PavilionReservationPersonaValue;
  sunsetMinutes: number;
}): PavilionAfterHoursBand | null {
  if (props.persona === 'mit_academic') {
    return null;
  }
  if (props.endMinutes <= props.sunsetMinutes) {
    return null;
  }

  const key: PavilionAfterHoursBandKey =
    props.endMinutes <= AFTER_CLOSE_THROUGH_10PM_MINUTES
      ? 'after_10'
      : 'after_midnight';
  const item = props.afterHoursItems.find(
    (candidate) => candidate.slug === key
  );
  if (!item) {
    return null;
  }
  const amountCents = priceForPersona(item, props.persona);
  if (amountCents === null) {
    return null;
  }

  return {
    amountCents,
    key,
    labelKey:
      key === 'after_10'
        ? 'after_hours_through_10pm'
        : 'after_hours_through_2am',
  };
}

type SlotLike = PavilionReservationSlotInput & { id: string };

/**
 * Rebuilds after-hours fee slots from complete hourly venue bookings.
 * One after-hours slot is attached per hourly line (replace, don't stack).
 *
 * @param props - Current slots, catalog, and persona
 * @returns Slots with derived after-hours rows synced to hourly bookings
 */
export function syncPavilionAfterHoursSlots<TSlot extends SlotLike>(props: {
  afterHoursItems: readonly PavilionReservableItemDto[];
  createSlotId: () => string;
  hourlyVenueIds: ReadonlySet<string>;
  persona: PavilionReservationPersonaValue;
  slots: readonly TSlot[];
}): TSlot[] {
  const afterHoursIds = new Set(props.afterHoursItems.map((item) => item.id));
  const cleaned = props.slots.filter((slot) => !afterHoursIds.has(slot.itemId));

  const derived: TSlot[] = [];
  for (const slot of cleaned) {
    if (
      !props.hourlyVenueIds.has(slot.itemId) ||
      !slot.date ||
      !(slot.endMinutes > slot.startMinutes)
    ) {
      continue;
    }
    const sunsetMinutes = pavilionReservationSunsetMinutes(slot.date);
    const band = pavilionAfterHoursBandForEnd({
      afterHoursItems: props.afterHoursItems,
      endMinutes: slot.endMinutes,
      persona: props.persona,
      sunsetMinutes,
    });
    if (!band) {
      continue;
    }
    const item = props.afterHoursItems.find(
      (candidate) => candidate.slug === band.key
    );
    if (!item) {
      continue;
    }
    const startMinutes = Math.max(
      Math.min(sunsetMinutes, slot.endMinutes - 30),
      7 * 60
    );
    const derivedSlot = {
      date: slot.date,
      endMinutes: slot.endMinutes,
      id: props.createSlotId(),
      itemId: item.id,
      startMinutes,
    };
    derived.push({ ...slot, ...derivedSlot });
  }

  return [...cleaned, ...derived];
}
