import 'server-only';
import { prisma } from '@/libs/DB';
import { PAVILION_RESERVATION_PERSONAS } from '@/libs/mit-sailing/pavilionReservationPricing';
import type {
  PavilionReservableItemDto,
  PavilionReservationPriceMap,
} from '@/libs/mit-sailing/pavilionReservationTypes';

export type PavilionReservationBlockedRangeDto = {
  itemId: string;
  date: string;
  startMinutes: number;
  endMinutes: number;
};

function emptyPriceMap(): PavilionReservationPriceMap {
  return {
    mit_academic: null,
    mit_student: null,
    mit_community: null,
    non_mit: null,
  };
}

function priceMapFromRows(
  rows: {
    persona: keyof PavilionReservationPriceMap;
    amountCents: number | null;
  }[]
): PavilionReservationPriceMap {
  const prices = emptyPriceMap();
  for (const row of rows) {
    prices[row.persona] = row.amountCents;
  }
  return prices;
}

export async function listVisiblePavilionReservableItems(): Promise<
  PavilionReservableItemDto[]
> {
  const rows = await prisma.pavilionReservableItem.findMany({
    where: { isVisible: true },
    orderBy: [{ kind: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      kind: true,
      name: true,
      description: true,
      imageUrl: true,
      pricingType: true,
      minDurationHours: true,
      displayOrder: true,
      prices: {
        where: { persona: { in: [...PAVILION_RESERVATION_PERSONAS] } },
        select: { persona: true, amountCents: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    name: row.name,
    description: row.description,
    imageUrl: row.imageUrl,
    pricingType: row.pricingType,
    minDurationHours: row.minDurationHours,
    displayOrder: row.displayOrder,
    prices: priceMapFromRows(row.prices),
  }));
}

export async function listPavilionReservationBlockedRanges(): Promise<
  PavilionReservationBlockedRangeDto[]
> {
  const ranges = await prisma.$queryRaw<PavilionReservationBlockedRangeDto[]>`
    SELECT
      slot.item_id AS "itemId",
      to_char(slot.requested_date, 'YYYY-MM-DD') AS "date",
      slot.start_minutes AS "startMinutes",
      slot.end_minutes AS "endMinutes"
    FROM pavilion_reservation_slots slot
    INNER JOIN pavilion_reservation_requests reservation_request
      ON reservation_request.id = slot.request_id
    WHERE reservation_request.status::text IN ('needs_info', 'approved')
    ORDER BY slot.requested_date ASC, slot.item_id ASC, slot.start_minutes ASC
  `;
  return ranges;
}
