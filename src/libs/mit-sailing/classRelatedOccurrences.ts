import { prisma } from '@/libs/DB';
import { formatEasternEventRange } from '@/libs/mit-sailing/easternTimeFormat';

export type RelatedOccurrenceLine = {
  eventDateId: string;
  rangeLabel: string;
};

export type ClassRelatedEventBlock = {
  eventId: string;
  event: { id: string; name: string; slug: string } | null;
  occurrenceLines: RelatedOccurrenceLine[];
};

/**
 * For each event id in order, up to `limitPerEvent` future published occurrences
 * (mit-redesign `getNextOccurrencesForEventIds` semantics).
 *
 * @param eventIdsInOrder - Related event ids from the sailing class (order preserved)
 * @param options - Reference time and per-event cap
 * @returns Blocks aligned to `eventIdsInOrder`
 */
export async function getClassRelatedEventOccurrenceBlocks(
  eventIdsInOrder: string[],
  options?: { reference?: Date; limitPerEvent?: number }
): Promise<ClassRelatedEventBlock[]> {
  const reference = options?.reference ?? new Date();
  const limitPerEvent = options?.limitPerEvent ?? 3;
  if (eventIdsInOrder.length === 0) {
    return [];
  }

  const uniqueIds = [...new Set(eventIdsInOrder)];

  const [events, dates] = await Promise.all([
    prisma.event.findMany({
      where: { id: { in: uniqueIds }, isPublished: true },
      select: { id: true, name: true, slug: true },
    }),
    prisma.eventDate.findMany({
      where: {
        startDateTime: { gte: reference },
        eventId: { in: uniqueIds },
        event: { isPublished: true },
      },
      orderBy: { startDateTime: 'asc' },
      select: {
        id: true,
        eventId: true,
        startDateTime: true,
        endDateTime: true,
      },
    }),
  ]);

  const eventById = new Map(events.map((e) => [e.id, e]));
  const datesByEvent = new Map<string, typeof dates>();
  for (const d of dates) {
    let bucket = datesByEvent.get(d.eventId);
    if (!bucket) {
      bucket = [];
      datesByEvent.set(d.eventId, bucket);
    }
    bucket.push(d);
  }

  const blocks: ClassRelatedEventBlock[] = [];
  for (const eventId of eventIdsInOrder) {
    const event = eventById.get(eventId) ?? null;
    const bucket = datesByEvent.get(eventId) ?? [];
    const slice = bucket.slice(0, limitPerEvent);
    const occurrenceLines: RelatedOccurrenceLine[] = slice.map((row) => ({
      eventDateId: row.id,
      rangeLabel: formatEasternEventRange(row.startDateTime, row.endDateTime),
    }));
    blocks.push({ eventId, event, occurrenceLines });
  }

  return blocks;
}
