import {
  emptyPavilionReservationPriceMap,
  PAVILION_RESERVATION_PERSONAS,
} from '@/libs/mit-sailing/pavilionReservationPersonas';
import type { PavilionReservationPersonaValue } from '@/libs/mit-sailing/pavilionReservationPersonas';

export type PavilionReservableItemSeed = {
  id: string;
  slug: string;
  kind: 'space' | 'service';
  name: string;
  description: string;
  imageUrl: string | null;
  pricingType: 'hourly' | 'flat';
  minDurationHours: number | null;
  displayOrder: number;
  isVisible: boolean;
  prices: Record<PavilionReservationPersonaValue, number | null>;
};

function centsByPersona(
  dollarsByPersona: Record<PavilionReservationPersonaValue, number | null>
): Record<PavilionReservationPersonaValue, number | null> {
  const cents = emptyPavilionReservationPriceMap();

  for (const persona of PAVILION_RESERVATION_PERSONAS) {
    const dollars = dollarsByPersona[persona];
    if (dollars === null) {
      cents[persona] = null;
      continue;
    }
    if (!Number.isInteger(dollars) || dollars < 0) {
      throw new TypeError(
        `Pavilion seed price must be non-negative whole dollars (${persona}=${dollars})`
      );
    }
    cents[persona] = dollars * 100;
  }

  return cents;
}

const pavilionImageUrl = '/assets/images/pavilion-reservation-placeholder.svg';

export const PAVILION_RESERVABLE_ITEM_SEED_ROWS: readonly PavilionReservableItemSeed[] =
  [
    {
      id: 'pavilion-item-grill',
      slug: 'grill',
      kind: 'space',
      name: 'Barbecue Grill, flat fee per grill',
      description:
        'Reserve grill access for your event. Staff can adjust grill quantity during review.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 0,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 30,
        mit_student: 30,
        mit_community: 30,
        non_mit: 30,
      }),
    },
    {
      id: 'pavilion-item-casual-dock',
      slug: 'casual_dock',
      kind: 'space',
      name: 'Casual party space - Shore School/Wooden Dock in front (50 People Max)',
      description:
        'Perfect for casual gatherings and events with up to 50 people.',
      pricingType: 'hourly',
      minDurationHours: 1,
      imageUrl: pavilionImageUrl,
      displayOrder: 10,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 320,
        mit_student: 200,
        mit_community: 320,
        non_mit: 580,
      }),
    },
    {
      id: 'pavilion-item-roof-deck',
      slug: 'roof_deck',
      kind: 'space',
      name: 'Entire east roof deck area (100 People Max)',
      description:
        'Spacious roof deck area ideal for larger events with up to 100 people.',
      pricingType: 'hourly',
      minDurationHours: 1,
      imageUrl: pavilionImageUrl,
      displayOrder: 20,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 320,
        mit_student: 200,
        mit_community: 320,
        non_mit: 610,
      }),
    },
    {
      id: 'pavilion-item-party-boat',
      slug: 'party_boat',
      kind: 'space',
      name: 'Party boat dock, 15 minutes each way',
      description: 'Boat dock access for your event transportation needs.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: pavilionImageUrl,
      displayOrder: 30,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 130,
        mit_student: 130,
        mit_community: 130,
        non_mit: 130,
      }),
    },
    {
      id: 'pavilion-item-lab-access',
      slug: 'lab_access',
      kind: 'space',
      name: 'Lab Access / Dock Experiment',
      description: 'Fees arranged with Sailing Master.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: pavilionImageUrl,
      displayOrder: 70,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: null,
        mit_student: null,
        mit_community: null,
        non_mit: null,
      }),
    },
    {
      id: 'pavilion-item-wedding-space',
      slug: 'wedding_space',
      kind: 'space',
      name: 'Wedding/ Wedding Rehearsal/ Wedding Reception (in addition to hourly)',
      description: 'Special wedding package space reservation.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: pavilionImageUrl,
      displayOrder: 40,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: null,
        mit_student: 650,
        mit_community: 650,
        non_mit: 825,
      }),
    },
    {
      id: 'pavilion-item-after-10',
      slug: 'after_10',
      kind: 'space',
      name: 'Use after regular close until 10:00pm (in addition to hourly rate)',
      description:
        'Request extended Pavilion use after regular closing until 10:00pm.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 50,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: null,
        mit_student: 325,
        mit_community: 410,
        non_mit: 575,
      }),
    },
    {
      id: 'pavilion-item-after-midnight',
      slug: 'after_midnight',
      kind: 'space',
      name: 'Use after regular close until Midnight (in addition to hourly rate)',
      description:
        'Request extended Pavilion use after regular closing until midnight.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 60,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: null,
        mit_student: 585,
        mit_community: 650,
        non_mit: 775,
      }),
    },
    {
      id: 'pavilion-item-group-sailing',
      slug: 'group_sailing',
      kind: 'space',
      name: 'Group Sailing Lesson (20-40 people, Summer Only)',
      description:
        'Group sailing lessons for 20-40 people, available in summer.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: pavilionImageUrl,
      displayOrder: 80,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 3500,
        mit_student: 3500,
        mit_community: 3500,
        non_mit: 4500,
      }),
    },
    {
      id: 'pavilion-item-wedding-service',
      slug: 'wedding_service',
      kind: 'service',
      name: 'Wedding/ Wedding Rehearsal/ Wedding Reception',
      description: 'Special wedding package (in addition to hourly rate).',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 130,
      isVisible: false,
      prices: centsByPersona({
        mit_academic: null,
        mit_student: 650,
        mit_community: 650,
        non_mit: 825,
      }),
    },
  ] as const;
