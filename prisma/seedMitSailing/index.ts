import { prisma } from '../../src/libs/DB';
import {
  seedEventCategories,
  seedEventRelatedRows,
  seedEvents,
  seedSailingClassesAndBoats,
  seedStaff,
  seedStubUsers,
} from './steps';

/**
 * Idempotent: upserts MIT Sailing domain rows (users, events, staff, fleet) for dev and tests.
 * Catalog lives in `src/data/mit-sailing/`; this pushes the same data into PostgreSQL.
 *
 * @returns Promise that resolves when all steps complete
 */
export async function seedMitSailing(): Promise<void> {
  await seedStubUsers(prisma);
  await seedEventCategories(prisma);
  await seedSailingClassesAndBoats(prisma);
  await seedStaff(prisma);
  await seedEvents(prisma);
  await seedEventRelatedRows(prisma);
}
