import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { prisma } from '@/libs/DB';
import { Env } from '@/libs/Env';
import { createLegacyMysqlReader } from '@/libs/legacy-sync/legacyMysqlReader';
import {
  importLegacyPavilionReservationRows,
  importLegacyPavilionReservations,
  legacyPavilionReservationRowsFromCsv,
} from '@/libs/legacy-sync/legacyPavilionReservationImport';

async function main(): Promise<void> {
  const sourceFlag = process.argv[2]?.trim();
  if (sourceFlag === '--source=mysql') {
    const password = Env.LEGACY_MYSQL_PASSWORD;
    if (!password) {
      throw new Error(
        'LEGACY_MYSQL_PASSWORD is required when using --source=mysql.'
      );
    }
    const reader = createLegacyMysqlReader({ password });
    try {
      const result = await importLegacyPavilionReservations(reader);
      console.log(
        `Imported ${result.imported} legacy Pavilion reservations from MySQL; skipped ${result.skipped}.`
      );
    } finally {
      await reader.close();
    }
    return;
  }

  const csvPath = sourceFlag;
  if (!csvPath) {
    throw new Error(
      'Legacy Pavilion reservations CSV path is required.\nUsage: tsx scripts/import-legacy-pavilion-reservations.ts <path-to.csv>\nOr: tsx scripts/import-legacy-pavilion-reservations.ts --source=mysql'
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

async function runCli(): Promise<void> {
  try {
    await run();
  } catch (error: unknown) {
    console.error(error);
    process.exitCode = 1;
  }
}

// eslint-disable-next-line no-void -- script entry
void runCli();
