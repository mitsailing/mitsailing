import 'dotenv/config';
import { seedDonationFunds } from '../prisma/seedMitSailing/steps';
import { prisma } from '../src/libs/DB';

/**
 * Upserts only `donation_funds` rows (idempotent). Uses `DATABASE_URL` from
 * `.env` / `.env.local` — your dev database when you run this locally.
 */
async function main(): Promise<void> {
  try {
    await seedDonationFunds(prisma);
    console.log('[seed-donation-funds] done');
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect().catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
  }
}

// eslint-disable-next-line no-void -- script entry
void main();
