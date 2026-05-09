import { prisma } from '../../src/libs/DB';
import {
  seedClassCategories,
  seedCmsContent,
  seedDonationFunds,
  seedEventCategories,
  seedEventRelatedRows,
  seedEvents,
  seedSailingClassRelatedEventsFromSeed,
  seedSailingClassesAndBoats,
  seedSiteAlerts,
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
  await seedClassCategories(prisma);
  await seedSailingClassesAndBoats(prisma);
  await seedStaff(prisma);
  await seedEvents(prisma);
  await seedSailingClassRelatedEventsFromSeed(prisma);
  await seedEventRelatedRows(prisma);
  await seedDonationFunds(prisma);
  await seedSiteAlerts(prisma);
  await seedCmsContent(prisma);
}
