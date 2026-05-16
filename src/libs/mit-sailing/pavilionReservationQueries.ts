import 'server-only';
import { addNyCalendarDays, nyYmd } from '@/lib/mit-sailing/nyTime';
import { prisma } from '@/libs/DB';
import {
  isoCalendarDateFromPrismaDate,
  prismaDateFromIsoCalendar,
} from '@/libs/mit-sailing/isoCalendarDate';
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

/** Default inclusive end offset from the resolved start date (venue calendar days). */
const PAVILION_RESERVATION_BLOCKED_RANGE_DEFAULT_DAY_SPAN = 800;

/**
 * Lists blocked slot ranges for active requests within a date window.
 *
 * @param props - Optional inclusive `startDate` / `endDate` (`@db.Date`). Defaults use
 *   Eastern today and an ~800-day lookahead; pass a wider `endDate` if the booking UI
 *   needs conflicts farther out.
 * @returns Blocked slot ranges ordered by date, item, and start time.
 * @throws If the generated Eastern calendar window cannot be converted to Prisma dates.
 */
export async function listPavilionReservationBlockedRanges(props?: {
  startDate?: Date;
  endDate?: Date;
}): Promise<PavilionReservationBlockedRangeDto[]> {
  const now = new Date();
  const defaultStartIso = nyYmd(now);
  const defaultStart = prismaDateFromIsoCalendar(defaultStartIso);
  if (!defaultStart) {
    throw new Error(
      `Unexpected invalid Eastern calendar key for pavilion blocked ranges: ${defaultStartIso}`
    );
  }
  const startDate = props?.startDate ?? defaultStart;
  const startIso = isoCalendarDateFromPrismaDate(startDate);
  const defaultEndIso = addNyCalendarDays(
    startIso,
    PAVILION_RESERVATION_BLOCKED_RANGE_DEFAULT_DAY_SPAN
  );
  const defaultEnd = prismaDateFromIsoCalendar(defaultEndIso);
  if (!defaultEnd) {
    throw new Error(
      `Unexpected invalid end calendar key for pavilion blocked ranges: ${defaultEndIso}`
    );
  }
  const endDate = props?.endDate ?? defaultEnd;

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
      AND slot.requested_date >= ${startDate}
      AND slot.requested_date <= ${endDate}
    ORDER BY slot.requested_date ASC, slot.item_id ASC, slot.start_minutes ASC
  `;
  return ranges;
}
