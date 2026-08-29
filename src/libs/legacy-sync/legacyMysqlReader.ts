import type { RowDataPacket } from 'mysql2/promise';
import { Env } from '@/libs/Env';
import type {
  LegacyEventBoatRow,
  LegacyEventContactRow,
  LegacyEventDateRow,
  LegacyEventFeeRow,
  LegacyEventRegistrationRow,
  LegacyEventRow,
  LegacyEventTypeRow,
} from '@/libs/legacy-sync/legacyEventImport';
import type { LegacyMemberRow } from '@/libs/legacy-sync/legacyMemberIdentity';
import {
  legacyMysqlStringScalar,
  normalizeLegacyMysqlCellValue,
  normalizeLegacyMysqlStringRow,
} from '@/libs/legacy-sync/legacyMysqlRowNormalization';
import type { LegacyNewsRow } from '@/libs/legacy-sync/legacyNewsImport';
import type { LegacyReservationDbRow } from '@/libs/legacy-sync/legacyPavilionReservationImport';
import type { LegacyPaymentRow } from '@/libs/legacy-sync/legacyPaymentImport';
import type {
  LegacyRatingRow,
  LegacyRatingTypeRow,
} from '@/libs/legacy-sync/legacyRatingImport';
import { openLegacyMysqlConnection } from '@/libs/legacy-sync/mysqlConnection';
import type {
  LegacyMysqlConnection,
  LegacyMysqlConnectionEnv,
} from '@/libs/legacy-sync/mysqlConnection';
import { quoteMysqlIdentifier } from '@/libs/legacy-sync/mysqlIdentifiers';

export type LegacyMysqlReaderFixtures = {
  readonly activeMembers: readonly LegacyMemberRow[];
  readonly eventBoats: readonly LegacyEventBoatRow[];
  readonly eventContacts: readonly LegacyEventContactRow[];
  readonly eventDates: readonly LegacyEventDateRow[];
  readonly eventFees: readonly LegacyEventFeeRow[];
  readonly eventRegs: readonly LegacyEventRegistrationRow[];
  readonly eventTypes: readonly LegacyEventTypeRow[];
  readonly events: readonly LegacyEventRow[];
  readonly news: readonly LegacyNewsRow[];
  readonly payments: readonly LegacyPaymentRow[];
  readonly ratingTypes: readonly LegacyRatingTypeRow[];
  readonly ratings: readonly LegacyRatingRow[];
  readonly reservations: readonly LegacyReservationDbRow[];
};

export type LegacyMysqlReader = {
  close: () => Promise<void>;
  fetchActiveMembers: () => Promise<readonly LegacyMemberRow[]>;
  fetchEventBoats: () => Promise<readonly LegacyEventBoatRow[]>;
  fetchEventContacts: () => Promise<readonly LegacyEventContactRow[]>;
  fetchEventDates: () => Promise<readonly LegacyEventDateRow[]>;
  fetchEventFees: () => Promise<readonly LegacyEventFeeRow[]>;
  fetchEventRegs: () => Promise<readonly LegacyEventRegistrationRow[]>;
  fetchEventTypes: () => Promise<readonly LegacyEventTypeRow[]>;
  fetchEvents: () => Promise<readonly LegacyEventRow[]>;
  fetchNews: () => Promise<readonly LegacyNewsRow[]>;
  fetchPayments: () => Promise<readonly LegacyPaymentRow[]>;
  fetchRatingTypes: () => Promise<readonly LegacyRatingTypeRow[]>;
  fetchRatings: () => Promise<readonly LegacyRatingRow[]>;
  fetchReservations: () => Promise<readonly LegacyReservationDbRow[]>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function queryLegacyStringRows<T extends Record<string, unknown>>(
  connection: LegacyMysqlConnection,
  sql: string
): Promise<readonly T[]> {
  const [rows] = await connection.mysql.query<RowDataPacket[]>(sql);
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new TypeError('Legacy MySQL query returned a non-object row.');
    }
    // MySQL driver rows are untyped; normalize then trust importer row shapes.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- legacy MySQL boundary
    return normalizeLegacyMysqlStringRow(row) as T;
  });
}

async function queryLegacyReservationRows(
  connection: LegacyMysqlConnection,
  sql: string
): Promise<readonly LegacyReservationDbRow[]> {
  const reservationNumberFields = new Set([
    'active',
    'confirmed',
    'contacted',
    'datesel',
    'infoalcohol',
    'infotent',
    'paid',
    'tentative',
  ]);
  const [rows] = await connection.mysql.query<RowDataPacket[]>(sql);
  return rows.map((row) => {
    if (!isRecord(row)) {
      throw new TypeError('Legacy MySQL query returned a non-object row.');
    }
    const normalized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      const cell = normalizeLegacyMysqlCellValue(value);
      if (cell === null || cell === undefined) {
        normalized[key] = null;
        continue;
      }
      if (reservationNumberFields.has(key)) {
        normalized[key] = Number(cell);
        continue;
      }
      normalized[key] = legacyMysqlStringScalar(cell);
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- legacy MySQL boundary
    return normalized as LegacyReservationDbRow;
  });
}

function membersTableSql(): string {
  return `SELECT * FROM ${quoteMysqlIdentifier('members')} WHERE active = '1' ORDER BY lower(trim(email)), record_date DESC, record DESC`;
}

export function createLegacyMysqlReader(props: {
  password: string;
  env?: LegacyMysqlConnectionEnv;
}): LegacyMysqlReader {
  const connection = openLegacyMysqlConnection(props);

  return {
    close: async () => {
      await connection.close();
    },
    fetchActiveMembers: async () => {
      const rows = await queryLegacyStringRows<LegacyMemberRow>(
        connection,
        membersTableSql()
      );
      return rows;
    },
    fetchEventTypes: async () => {
      const rows = await queryLegacyStringRows<LegacyEventTypeRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_types')} ORDER BY \`rank\``
      );
      return rows;
    },
    fetchEvents: async () => {
      const rows = await queryLegacyStringRows<LegacyEventRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('events')} ORDER BY idx`
      );
      return rows;
    },
    fetchEventDates: async () => {
      const rows = await queryLegacyStringRows<LegacyEventDateRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_dates')} ORDER BY eid, date, start`
      );
      return rows;
    },
    fetchEventRegs: async () => {
      const rows = await queryLegacyStringRows<LegacyEventRegistrationRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_regs')} ORDER BY eid, team_id, userid`
      );
      return rows;
    },
    fetchEventContacts: async () => {
      const rows = await queryLegacyStringRows<LegacyEventContactRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_contact')} ORDER BY eid, userid`
      );
      return rows;
    },
    fetchEventFees: async () => {
      const rows = await queryLegacyStringRows<LegacyEventFeeRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_fees')} ORDER BY eid, feeid`
      );
      return rows;
    },
    fetchEventBoats: async () => {
      const rows = await queryLegacyStringRows<LegacyEventBoatRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('event_boats')} ORDER BY eid, team_id, boat_num, boat_pos`
      );
      return rows;
    },
    fetchRatingTypes: async () => {
      const rows = await queryLegacyStringRows<LegacyRatingTypeRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('rating_type')} ORDER BY \`rank\``
      );
      return rows;
    },
    fetchRatings: async () => {
      const rows = await queryLegacyStringRows<LegacyRatingRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('ratings')} ORDER BY eval_date, id, rating_type`
      );
      return rows;
    },
    fetchNews: async () => {
      const rows = await queryLegacyStringRows<LegacyNewsRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('news')} ORDER BY id`
      );
      return rows;
    },
    fetchReservations: async () => {
      const rows = await queryLegacyReservationRows(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('reservations')} ORDER BY resid`
      );
      return rows;
    },
    fetchPayments: async () => {
      const rows = await queryLegacyStringRows<LegacyPaymentRow>(
        connection,
        `SELECT * FROM ${quoteMysqlIdentifier('payments')} ORDER BY date, omarsid`
      );
      return rows;
    },
  };
}

/**
 * Creates a reader backed by in-memory fixtures for tests and seed data.
 *
 * @param fixtures - Optional per-table fixture rows
 * @returns Reader that resolves fixture data without MySQL
 */
export function createFixtureLegacyMysqlReader(
  fixtures: Partial<LegacyMysqlReaderFixtures> = {}
): LegacyMysqlReader {
  return {
    close: async () => {
      await Promise.resolve();
    },
    fetchActiveMembers: async () => {
      const rows = await Promise.resolve(fixtures.activeMembers ?? []);
      return rows;
    },
    fetchEventTypes: async () => {
      const rows = await Promise.resolve(fixtures.eventTypes ?? []);
      return rows;
    },
    fetchEvents: async () => {
      const rows = await Promise.resolve(fixtures.events ?? []);
      return rows;
    },
    fetchEventDates: async () => {
      const rows = await Promise.resolve(fixtures.eventDates ?? []);
      return rows;
    },
    fetchEventRegs: async () => {
      const rows = await Promise.resolve(fixtures.eventRegs ?? []);
      return rows;
    },
    fetchEventContacts: async () => {
      const rows = await Promise.resolve(fixtures.eventContacts ?? []);
      return rows;
    },
    fetchEventFees: async () => {
      const rows = await Promise.resolve(fixtures.eventFees ?? []);
      return rows;
    },
    fetchEventBoats: async () => {
      const rows = await Promise.resolve(fixtures.eventBoats ?? []);
      return rows;
    },
    fetchRatingTypes: async () => {
      const rows = await Promise.resolve(fixtures.ratingTypes ?? []);
      return rows;
    },
    fetchRatings: async () => {
      const rows = await Promise.resolve(fixtures.ratings ?? []);
      return rows;
    },
    fetchNews: async () => {
      const rows = await Promise.resolve(fixtures.news ?? []);
      return rows;
    },
    fetchReservations: async () => {
      const rows = await Promise.resolve(fixtures.reservations ?? []);
      return rows;
    },
    fetchPayments: async () => {
      const rows = await Promise.resolve(fixtures.payments ?? []);
      return rows;
    },
  };
}

/**
 * Opens a reader from validated env; requires LEGACY_MYSQL_PASSWORD.
 *
 * @param env - Validated env with optional legacy MySQL password
 * @returns Reader configured from env host and credentials
 */
export function legacyMysqlReaderFromEnv(
  env: LegacyMysqlConnectionEnv & {
    LEGACY_MYSQL_PASSWORD?: string;
  } = Env
): LegacyMysqlReader {
  const password = env.LEGACY_MYSQL_PASSWORD;
  if (!password) {
    throw new Error('LEGACY_MYSQL_PASSWORD is required for legacy import.');
  }
  return createLegacyMysqlReader({ password, env });
}
