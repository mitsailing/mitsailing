import 'dotenv/config';
import { createSeedPrisma, seedDatabaseUrl } from '../prisma/seedClient';
import { seedDonationFunds } from '../prisma/seedMitSailing/steps';

/**
 * Upserts only `donation_funds` rows (idempotent). Uses `DATABASE_URL` from
 * `.env` / `.env.local` — your dev database when you run this locally.
 */
async function main(): Promise<void> {
  const { pool, prisma } = createSeedPrisma(seedDatabaseUrl());
  try {
    await seedDonationFunds(prisma);
    console.log('[seed-donation-funds] done');
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await prisma.$disconnect();
    } catch (error: unknown) {
      console.error(error);
      process.exitCode = 1;
    }
    try {
      await pool.end();
    } catch (error: unknown) {
      console.error(error);
      process.exitCode = 1;
    }
  }
}

// eslint-disable-next-line no-void -- script entry
void main();
