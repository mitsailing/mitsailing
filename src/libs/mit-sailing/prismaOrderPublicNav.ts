import { Prisma } from '@/generated/prisma/client';

/**
 * Shared Prisma ordering: `display_order` ascending, then `name` ascending
 * (`FleetBoat`, `ClassCategory`).
 */
export const prismaOrderByDisplayOrderAscNameAsc = [
  { displayOrder: Prisma.SortOrder.asc },
  { name: Prisma.SortOrder.asc },
] satisfies Prisma.ClassCategoryOrderByWithRelationInput[];
