import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { prisma } from '@/libs/DB';
import {
  importLegacyPavilionReservationRows,
  importLegacyPavilionReservationsFromSchema,
  legacyPavilionReservationRowsFromCsv,
} from '@/libs/legacy-sync/legacyPavilionReservationImport';

async function main(): Promise<void> {
  const sourceFlag = process.argv[2]?.trim();
  if (sourceFlag === '--source=legacy-schema') {
    const result = await importLegacyPavilionReservationsFromSchema();
    console.log(
      `Imported ${result.imported} legacy Pavilion reservations from legacy.reservations; skipped ${result.skipped}.`
    );
    return;
  }

  const csvPath = sourceFlag;
  if (!csvPath) {
    throw new Error(
      'Legacy Pavilion reservations CSV path is required.\nUsage: tsx scripts/import-legacy-pavilion-reservations.ts <path-to.csv>'
    );
  }
  const csv = await readFile(csvPath, 'utf8');
  const result = await importLegacyPavilionReservationRows(
    legacyPavilionReservationRowsFromCsv(csv)
  );

  console.log(
    `Imported ${result.imported} legacy Pavilion reservations; skipped ${result.skipped}.`
  );
}

async function run(): Promise<void> {
  try {
    await main();
  } finally {
    await prisma.$disconnect();
  }
}

try {
  await run();
} catch (error: unknown) {
  console.error(error);
  process.exitCode = 1;
}
