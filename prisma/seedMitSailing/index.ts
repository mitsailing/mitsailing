import type { PrismaClient } from '../../src/generated/prisma/client';
import {
  seedClassCategories,
  seedCmsContent,
  seedDonationFunds,
  seedEventCategories,
  seedEventRelatedRows,
  seedEvents,
  seedSailingClassRelatedEventsFromSeed,
  seedSailingClassesAndBoats,
  seedSailingRatings,
  seedSiteAlerts,
  seedStaff,
  seedStubUsers,
} from './steps';

/**
 * Loads legacy payment fixtures only outside production/staging so `tsx prisma/seed.ts`
 * in the Docker image never imports the Next.js DB singleton.
 *
 * @param prisma - Seed Prisma client
 */
async function seedDevOnlyLegacyPaymentFixtures(
  prisma: PrismaClient
): Promise<void> {
  const appEnv = process.env.APP_ENV;
  if (appEnv === 'production' || appEnv === 'staging') {
    return;
  }
  const { seedLegacyProcessorPaymentFixtures } =
    await import('./legacyPaymentFixtures');
  await seedLegacyProcessorPaymentFixtures(prisma);
}

/**
 * Idempotent: upserts MIT Sailing domain rows (users, events, staff, fleet) for dev and tests.
 * Catalog lives in `src/data/mit-sailing/`; this pushes the same data into PostgreSQL.
 * Pavilion reservable items are bootstrapped by migration only (not re-seeded).
 *
 * @param prisma - Seed Prisma client from `prisma/seedClient`
 */
export async function seedMitSailing(prisma: PrismaClient): Promise<void> {
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
  await seedSiteAlerts(prisma);
  await seedCmsContent(prisma);
  await seedDevOnlyLegacyPaymentFixtures(prisma);
}
