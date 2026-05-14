export type PavilionReservationPersonaSeed =
  | 'mit_academic'
  | 'mit_student'
  | 'mit_community'
  | 'non_mit';

export type PavilionReservableItemSeed = {
  id: string;
  slug: string;
  kind: 'space' | 'service';
  name: string;
  description: string;
  imageUrl: string | null;
  pricingType: 'hourly' | 'flat' | 'tbd';
  minDurationHours: number | null;
  displayOrder: number;
  isVisible: boolean;
  prices: Record<PavilionReservationPersonaSeed, number | null>;
};

const personas = [
  'mit_academic',
  'mit_student',
  'mit_community',
  'non_mit',
] as const satisfies readonly PavilionReservationPersonaSeed[];

function centsByPersona(
  prices: Record<PavilionReservationPersonaSeed, number | null>
): Record<PavilionReservationPersonaSeed, number | null> {
  const cents: Record<PavilionReservationPersonaSeed, number | null> = {
    mit_academic: null,
    mit_student: null,
    mit_community: null,
    non_mit: null,
  };

  for (const persona of personas) {
    const dollars = prices[persona];
    cents[persona] = dollars === null ? null : dollars * 100;
  }

  return cents;
}

export const PAVILION_RESERVABLE_ITEM_SEED_ROWS: readonly PavilionReservableItemSeed[] =
  [
    {
      id: 'pavilion-item-casual-dock',
      slug: 'casual_dock',
      kind: 'space',
      name: 'Casual party space - Shore School/Wooden Dock in front (50 People Max)',
      description:
        'Perfect for casual gatherings and events with up to 50 people.',
      pricingType: 'hourly',
      minDurationHours: 1,
      imageUrl:
        'https://images.unsplash.com/photo-1643151762788-9d30c38788f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3b29kZW4lMjBkb2NrJTIwbGFrZXxlbnwxfHx8fDE3NzgzNTk4OTV8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 0,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 320,
        mit_student: 200,
        mit_community: 250,
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
      imageUrl:
        'https://images.unsplash.com/photo-1660020485325-bd838be85f57?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyb29mdG9wJTIwZGVjayUyMGJ1aWxkaW5nfGVufDF8fHx8MTc3ODM1OTg5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 10,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 320,
        mit_student: 200,
        mit_community: 250,
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
      imageUrl:
        'https://images.unsplash.com/photo-1614790875363-9ebf01ecdc85?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwYXJ0eSUyMGJvYXQlMjBkb2NrfGVufDF8fHx8MTc3ODM1OTg5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 20,
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
      pricingType: 'tbd',
      minDurationHours: null,
      imageUrl:
        'https://images.unsplash.com/photo-1724860755552-55f1c46f763d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsYWIlMjBleHBlcmltZW50fGVufDF8fHx8MTc3ODM1OTg5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 30,
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
      imageUrl:
        'https://images.unsplash.com/photo-1767986012154-db9a321c8832?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3ZWRkaW5nJTIwcmVjZXB0aW9uJTIwc2V0dXB8ZW58MXx8fHwxNzc4MzU5ODk1fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 40,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 650,
        mit_student: null,
        mit_community: 650,
        non_mit: 825,
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
      imageUrl:
        'https://images.unsplash.com/photo-1616011919027-b3e07e32ffb9?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWlsYm9hdHMlMjBvbiUyMHdhdGVyfGVufDF8fHx8MTc3ODM1OTg5NXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
      displayOrder: 50,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 3500,
        mit_student: 3500,
        mit_community: 3500,
        non_mit: 4500,
      }),
    },
    {
      id: 'pavilion-item-grill',
      slug: 'grill',
      kind: 'service',
      name: 'Barbecue Grill, flat fee per grill',
      description: 'Flat fee per grill. Blocks calendar when reserved.',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 100,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 30,
        mit_student: 30,
        mit_community: 30,
        non_mit: 30,
      }),
    },
    {
      id: 'pavilion-item-after-10',
      slug: 'after_10',
      kind: 'service',
      name: 'Use after regular close until 10:00pm',
      description:
        'Extended hours package until 10pm (in addition to hourly rate).',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 110,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 575,
        mit_student: 575,
        mit_community: 575,
        non_mit: 575,
      }),
    },
    {
      id: 'pavilion-item-after-midnight',
      slug: 'after_midnight',
      kind: 'service',
      name: 'Use after regular close until Midnight',
      description:
        'Extended hours package until midnight (in addition to hourly rate).',
      pricingType: 'flat',
      minDurationHours: null,
      imageUrl: null,
      displayOrder: 120,
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 775,
        mit_student: 775,
        mit_community: 775,
        non_mit: 775,
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
      isVisible: true,
      prices: centsByPersona({
        mit_academic: 825,
        mit_student: null,
        mit_community: 825,
        non_mit: 825,
      }),
    },
  ] as const;
