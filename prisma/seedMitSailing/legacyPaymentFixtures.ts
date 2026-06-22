import type { PrismaClient } from '../../src/generated/prisma/client';
import { Env } from '../../src/libs/Env';
import { importLegacyPaymentsFromSchema } from '../../src/libs/legacy-sync/legacyPaymentImport';

const legacyPaymentFixtureMemberIds = [
  '900000001',
  '900000002',
  '900000003',
  '900000004',
] as const;
const legacyPaymentFixtureEmails = [
  'legacy-racer@example.com',
  'legacy-crotr-paid@example.com',
  'legacy-state-hs-review@example.com',
  'legacy-regatta-paid@example.com',
] as const;
const legacyPaymentFixtureOrderIds = [
  'LEGACY-SEED-MEMBERSHIP-2026',
  'LEGACY-SEED-CROTR-2025-1',
  'LEGACY-SEED-CROTR-2025-2',
  'LEGACY-SEED-CROTR-2025-3',
  'LEGACY-SEED-STATE-HS-2026-1',
  'LEGACY-SEED-STATE-HS-2026-2',
  'LEGACY-SEED-REGATTA-PAID-2025',
  'LEGACY-SEED-REGATTA-REVIEW-2026',
] as const;
const deprecatedLegacyPaymentFixtureOrderIds = [
  'LEGACY-SEED-EVENT-2026',
  'LEGACY-SEED-REVIEW-2026',
] as const;

/**
 * Seeds a small legacy processor sample in the mirror schema, then imports it
 * through the same path used for production legacy payments.
 *
 * @param p - Prisma client
 */
export async function seedLegacyProcessorPaymentFixtures(
  p: PrismaClient
): Promise<void> {
  if (Env.APP_ENV === 'production' || Env.APP_ENV === 'staging') {
    return;
  }

  await p.$executeRaw`CREATE SCHEMA IF NOT EXISTS legacy`;
  await p.$executeRaw`
    CREATE TABLE IF NOT EXISTS legacy.members (
      active text,
      card text,
      email text,
      emer_email text,
      emer_name text,
      emer_phone text,
      expire_date text,
      first text,
      id text,
      last text,
      memb_type text,
      phone text,
      record text,
      record_date text,
      status_type text,
      username text
    )
  `;
  await p.$executeRaw`
    CREATE TABLE IF NOT EXISTS legacy.payments (
      amount text,
      "billTo_email" text,
      "billTo_firstName" text,
      "billTo_lastName" text,
      category text,
      date text,
      description text,
      last4 text,
      omarsid text,
      settled text,
      userid text
    )
  `;

  await p.$executeRaw`
    DELETE FROM legacy.payments
    WHERE omarsid IN (
      ${legacyPaymentFixtureOrderIds[0]},
      ${legacyPaymentFixtureOrderIds[1]},
      ${legacyPaymentFixtureOrderIds[2]},
      ${legacyPaymentFixtureOrderIds[3]},
      ${legacyPaymentFixtureOrderIds[4]},
      ${legacyPaymentFixtureOrderIds[5]},
      ${legacyPaymentFixtureOrderIds[6]},
      ${legacyPaymentFixtureOrderIds[7]},
      ${deprecatedLegacyPaymentFixtureOrderIds[0]},
      ${deprecatedLegacyPaymentFixtureOrderIds[1]}
    )
  `;
  await p.payment.deleteMany({
    where: {
      legacySourceId: { in: [...deprecatedLegacyPaymentFixtureOrderIds] },
      legacySourceTable: 'payments',
    },
  });
  await p.$executeRaw`
    DELETE FROM legacy.members
    WHERE id IN (
      ${legacyPaymentFixtureMemberIds[0]},
      ${legacyPaymentFixtureMemberIds[1]},
      ${legacyPaymentFixtureMemberIds[2]},
      ${legacyPaymentFixtureMemberIds[3]}
    )
      OR lower(email) IN (
        ${legacyPaymentFixtureEmails[0]},
        ${legacyPaymentFixtureEmails[1]},
        ${legacyPaymentFixtureEmails[2]},
        ${legacyPaymentFixtureEmails[3]}
      )
  `;

  await p.$executeRaw`
    INSERT INTO legacy.members (
      active,
      card,
      email,
      emer_email,
      emer_name,
      emer_phone,
      expire_date,
      first,
      id,
      last,
      memb_type,
      phone,
      record,
      record_date,
      status_type,
      username
    )
    VALUES
      (
        '1',
        '147',
        ${legacyPaymentFixtureEmails[0]},
        null,
        'Legacy Emergency',
        '+16175550123',
        '2026-07-15',
        'Jordan',
        ${legacyPaymentFixtureMemberIds[0]},
        'Racer',
        '1',
        '+16175550101',
        'legacy-seed-member-1',
        '2026-05-15 12:00:00',
        '2',
        'legacy-racer'
      ),
      (
        '1',
        null,
        ${legacyPaymentFixtureEmails[1]},
        null,
        'Legacy Contact',
        '+16175550124',
        null,
        'Morgan',
        ${legacyPaymentFixtureMemberIds[1]},
        'CROTR',
        '1',
        '+16175550102',
        'legacy-seed-member-2',
        '2025-06-27 12:00:00',
        '2',
        'legacy-crotr-paid'
      ),
      (
        '1',
        null,
        ${legacyPaymentFixtureEmails[2]},
        null,
        'Legacy Contact',
        '+16175550125',
        null,
        'Riley',
        ${legacyPaymentFixtureMemberIds[2]},
        'State',
        '1',
        '+16175550103',
        'legacy-seed-member-3',
        '2026-05-21 12:00:00',
        '2',
        'legacy-state-review'
      ),
      (
        '1',
        null,
        ${legacyPaymentFixtureEmails[3]},
        null,
        'Legacy Contact',
        '+16175550126',
        null,
        'Taylor',
        ${legacyPaymentFixtureMemberIds[3]},
        'Regatta',
        '1',
        '+16175550104',
        'legacy-seed-member-4',
        '2025-06-17 12:00:00',
        '2',
        'legacy-regatta-paid'
      )
  `;
  await p.$executeRaw`
    INSERT INTO legacy.payments (
      amount,
      "billTo_email",
      "billTo_firstName",
      "billTo_lastName",
      category,
      date,
      description,
      last4,
      omarsid,
      settled,
      userid
    )
    VALUES
      (
        '120.00',
        ${legacyPaymentFixtureEmails[0]},
        'Jordan',
        'Racer',
        'Racing',
        '2026-05-15',
        'Racing Card 2025-2026 for legacy-racer',
        '4242',
        ${legacyPaymentFixtureOrderIds[0]},
        '1',
        ${legacyPaymentFixtureMemberIds[0]}
      ),
      (
        '125.00',
        ${legacyPaymentFixtureEmails[1]},
        'Morgan',
        'CROTR',
        'Regatta',
        '2025-06-27',
        'Charles River Open Team Race - Team 19 Boat 1',
        '1881',
        ${legacyPaymentFixtureOrderIds[1]},
        '1',
        ${legacyPaymentFixtureMemberIds[1]}
      ),
      (
        '125.00',
        ${legacyPaymentFixtureEmails[1]},
        'Morgan',
        'CROTR',
        'Regatta',
        '2025-06-27',
        'Charles River Open Team Race - Team 19 Boat 2',
        '1881',
        ${legacyPaymentFixtureOrderIds[2]},
        '1',
        ${legacyPaymentFixtureMemberIds[1]}
      ),
      (
        '125.00',
        ${legacyPaymentFixtureEmails[1]},
        'Morgan',
        'CROTR',
        'Regatta',
        '2025-06-27',
        'Charles River Open Team Race - Team 19 Boat 3',
        '1881',
        ${legacyPaymentFixtureOrderIds[3]},
        '1',
        ${legacyPaymentFixtureMemberIds[1]}
      ),
      (
        '100.00',
        ${legacyPaymentFixtureEmails[2]},
        'Riley',
        'State',
        'Regatta',
        '2026-05-21',
        'State HS Champs 2026 - Team 15 Boat 1',
        '4444',
        ${legacyPaymentFixtureOrderIds[4]},
        '0',
        ${legacyPaymentFixtureMemberIds[2]}
      ),
      (
        '100.00',
        ${legacyPaymentFixtureEmails[2]},
        'Riley',
        'State',
        'Regatta',
        '2026-05-21',
        'State HS Champs 2026 - Team 15 Boat 2',
        '4444',
        ${legacyPaymentFixtureOrderIds[5]},
        '0',
        ${legacyPaymentFixtureMemberIds[2]}
      ),
      (
        '125.00',
        ${legacyPaymentFixtureEmails[3]},
        'Taylor',
        'Regatta',
        'Regatta',
        '2025-06-17',
        'Charles River Open Team Race - Team 25 Boat 2',
        '9155',
        ${legacyPaymentFixtureOrderIds[6]},
        '1',
        ${legacyPaymentFixtureMemberIds[3]}
      ),
      (
        '45.00',
        'legacy-review@example.com',
        'Unmatched',
        'Payer',
        'Regatta',
        '2026-06-02',
        'State HS Champs 2026 - Team 99 Boat 1',
        '0005',
        ${legacyPaymentFixtureOrderIds[7]},
        '1',
        '900000099'
      )
  `;

  await importLegacyPaymentsFromSchema();
}
