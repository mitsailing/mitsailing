import { cache } from 'react';
import { prisma } from '@/libs/DB';

/**
 * Published events for the public list view.
 *
 * @returns Published events ordered by name, with category and the earliest date row
 */
export async function listPublishedEventsForPublic() {
  const events = await prisma.event.findMany({
    where: { isPublished: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      description: true,
      isSpecial: true,
      category: { select: { name: true } },
      dates: {
        orderBy: { startDateTime: 'asc' },
        select: { startDateTime: true, endDateTime: true },
        take: 1,
      },
    },
  });
  return events;
}

/**
 * Single published event for detail, or `null` if not found or unpublished.
 * Wrapped in {@link https://react.dev/reference/react/cache React `cache`} for request deduplication
 * (metadata and page in the same render).
 *
 * @param slug - URL slug for the event
 * @returns Published event or `null`
 */
export const getPublishedEventForPublicBySlug = cache(async (slug: string) => {
  const event = await prisma.event.findFirst({
    where: { slug, isPublished: true },
    include: {
      category: { select: { name: true } },
      dates: { orderBy: { startDateTime: 'asc' } },
    },
  });
  return event;
});
