import { prisma } from '../../src/libs/DB';
import { seedEditableEmailTemplateDefaults } from '../../src/libs/email-templates/emailTemplateDefaultSeeder';
import {
  seedClassCategories,
  seedCmsContent,
  seedDonationFunds,
  seedEventCategories,
  seedEventRelatedRows,
  seedEvents,
  seedPavilionReservationCatalog,
  seedSailingClassRelatedEventsFromSeed,
  seedSailingClassesAndBoats,
  seedSailingRatings,
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
  await seedSailingRatings(prisma);
  await seedStaff(prisma);
  await seedEvents(prisma);
  await seedSailingClassRelatedEventsFromSeed(prisma);
  await seedEventRelatedRows(prisma);
  await seedDonationFunds(prisma);
  await seedPavilionReservationCatalog(prisma);
  await seedSiteAlerts(prisma);
  await seedCmsContent(prisma);
  await seedEditableEmailTemplateDefaults(prisma);
}
