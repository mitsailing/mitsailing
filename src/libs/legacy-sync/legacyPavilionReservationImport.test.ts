import { describe, expect, it } from 'vitest';
import {
  importLegacyPavilionReservationRows,
  importLegacyPavilionReservationsFromSchema,
  legacyPavilionReservationRowsFromCsv,
  legacyReservationReferenceCode,
  legacyReservationSlotDeleteWhere,
  minutesFromLegacyTime,
  minutesFromMysqlTime,
} from '@/libs/legacy-sync/legacyPavilionReservationImport';
import type { LegacyReservationDbRow } from '@/libs/legacy-sync/legacyPavilionReservationImport';

describe('legacyPavilionReservationImport', () => {
  it('exposes import entrypoints', () => {
    expect(importLegacyPavilionReservationRows).toBeTypeOf('function');
    expect(importLegacyPavilionReservationsFromSchema).toBeTypeOf('function');
  });

  it('parses legacy pavilion csv rows', () => {
    const csv = [
      'resid,first,last,mitid,email,phone,affil,groupname,title,acadfac,acadfacemail,acct,date1,start1,end1,date2,start2,end2,datesel,comments,infotent,infoalcohol,groupsize,active,tentative,confirmed,paid,contacted',
      'legacy-1,First,Last,123,email@example.com,555,student,Group,Roof deck event,,,,2026-07-01,2026-07-01 10:00:00 ,2026-07-01 12:00:00 ,,,,,Notes,1,0,25,1,0,0,0,1',
    ].join('\n');

    const rows = legacyPavilionReservationRowsFromCsv(csv);
    const row = rows[0] satisfies LegacyReservationDbRow | undefined;

    expect(row?.resid).toBe('legacy-1');
    expect(row?.email).toBe('email@example.com');
  });

  it('builds stable legacy reference codes', () => {
    expect(legacyReservationReferenceCode('2010-04-16:14:30:38-feb')).toBe(
      'LEG-2010-04-16-14-30-38-feb'
    );
  });

  it('parses mysql time strings to minutes', () => {
    expect(minutesFromMysqlTime('20:30:00')).toBe(1230);
  });

  it('parses legacy datetime strings to minutes of day', () => {
    expect(minutesFromLegacyTime('2026-07-01 10:00:00')).toBe(600);
    expect(minutesFromLegacyTime('2026-07-01 10:00:00 ')).toBe(600);
  });

  it('builds request-scoped slot deletion filters', () => {
    expect(legacyReservationSlotDeleteWhere('legacy-request-id')).toEqual({
      requestId: 'legacy-request-id',
    });
  });

  it('rejects empty slot deletion filters', () => {
    expect(() => legacyReservationSlotDeleteWhere('')).toThrow(
      'A request id is required to replace legacy reservation slots.'
    );
  });
});
