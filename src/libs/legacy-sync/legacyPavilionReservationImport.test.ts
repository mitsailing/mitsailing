import { describe, expect, it, vi } from 'vitest';
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

type FakeReservationTransaction = {
  pavilionReservationRequest: {
    upsert: (params: unknown) => Promise<{ id: string }>;
  };
  pavilionReservationSlot: {
    createMany: (params: unknown) => Promise<{ count: number }>;
    deleteMany: (params: unknown) => Promise<{ count: number }>;
  };
};

type FakeReservationTransactionCallback = (
  tx: FakeReservationTransaction
) => Promise<unknown>;

type FakeTransaction = (
  callback: FakeReservationTransactionCallback
) => Promise<unknown>;

const { prisma } = vi.hoisted(() => ({
  prisma: {
    $transaction: vi.fn<FakeTransaction>(async () => {
      await Promise.resolve();
    }),
    pavilionReservableItem: {
      findMany: vi.fn(async () => {
        await Promise.resolve();
        return [{ id: 'roof-item', slug: 'roof_deck' }];
      }),
    },
  },
}));

vi.mock('@/libs/DB', () => ({
  prisma,
}));

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

  it('parses quoted legacy csv fields with escaped characters', () => {
    const row = [
      'legacy-quoted',
      'First',
      'Last',
      '123',
      'email@example.com',
      '555',
      'student',
      '"Group, with comma"',
      '"Roof ""deck"" event"',
      '',
      '',
      '',
      '2026-07-01',
      '2026-07-01 10:00:00',
      '2026-07-01 12:00:00',
      '',
      '',
      '',
      '1',
      '"Line one, with comma\nLine two with ""quote"""',
      '1',
      '0',
      '25',
      '1',
      '0',
      '0',
      '0',
      '1',
    ].join(',');
    const csv = [
      'resid,first,last,mitid,email,phone,affil,groupname,title,acadfac,acadfacemail,acct,date1,start1,end1,date2,start2,end2,datesel,comments,infotent,infoalcohol,groupsize,active,tentative,confirmed,paid,contacted',
      row,
    ].join('\n');

    const rows = legacyPavilionReservationRowsFromCsv(csv);

    expect(rows[0]?.groupname).toBe('Group, with comma');
    expect(rows[0]?.title).toBe('Roof "deck" event');
    expect(rows[0]?.comments).toBe(
      'Line one, with comma\nLine two with "quote"'
    );
  });

  it('rejects legacy csv that ends inside a quoted field', () => {
    const csv = [
      'resid,first,last,mitid,email,phone,affil,groupname,title,acadfac,acadfacemail,acct,date1,start1,end1,date2,start2,end2,datesel,comments,infotent,infoalcohol,groupsize,active,tentative,confirmed,paid,contacted',
      'legacy-1,First,Last,123,email@example.com,555,student,"unclosed',
    ].join('\n');

    expect(() => legacyPavilionReservationRowsFromCsv(csv)).toThrow(
      'ends inside a quoted field'
    );
  });

  it('rejects legacy csv rows with the wrong field count', () => {
    const csv = [
      'resid,first,last,mitid,email,phone,affil,groupname,title,acadfac,acadfacemail,acct,date1,start1,end1,date2,start2,end2,datesel,comments,infotent,infoalcohol,groupsize,active,tentative,confirmed,paid,contacted',
      'legacy-1,First,Last,123,email@example.com,555,student,Group,Roof deck event,,,,2026-07-01,2026-07-01 10:00:00,2026-07-01 12:00:00,,,,Notes,1,0,25,1,0,0,0',
    ].join('\n');

    expect(() => legacyPavilionReservationRowsFromCsv(csv)).toThrow(
      'wrong field count'
    );
  });

  it('skips rows when inferred slugs do not all resolve in catalog', async () => {
    const result = await importLegacyPavilionReservationRows([
      {
        resid: 'legacy-partial-slugs',
        first: 'First',
        last: 'Last',
        mitid: null,
        email: 'partial@example.com',
        phone: '555',
        affil: 'student',
        groupname: 'Group',
        title: 'Roof deck party on the dock',
        acadfac: null,
        acadfacemail: null,
        acct: null,
        date1: '2026-07-01',
        start1: '10:00:00',
        end1: '12:00:00',
        date2: null,
        start2: null,
        end2: null,
        datesel: 1,
        comments: '',
        infotent: 0,
        infoalcohol: 0,
        groupsize: '10',
        active: 1,
        tentative: 0,
        confirmed: 0,
        paid: 0,
        contacted: 1,
      },
    ]);

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('skips rows when space text cannot be inferred', async () => {
    const result = await importLegacyPavilionReservationRows([
      {
        resid: 'legacy-unknown',
        first: 'First',
        last: 'Last',
        mitid: null,
        email: 'unknown@example.com',
        phone: '555',
        affil: 'student',
        groupname: 'Unclear group',
        title: 'Ambiguous event',
        acadfac: null,
        acadfacemail: null,
        acct: null,
        date1: '2026-07-01',
        start1: '10:00:00',
        end1: '12:00:00',
        date2: null,
        start2: null,
        end2: null,
        datesel: 1,
        comments: 'No pavilion space keyword here',
        infotent: 0,
        infoalcohol: 0,
        groupsize: '10',
        active: 1,
        tentative: 0,
        confirmed: 0,
        paid: 0,
        contacted: 1,
      },
    ]);

    expect(result).toEqual({ imported: 0, skipped: 1 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('builds stable legacy reference codes', () => {
    expect(legacyReservationReferenceCode('2010-04-16:14:30:38-feb')).toBe(
      'LEG-2010-04-16-14-30-38-feb'
    );
  });

  it('imports rows when resid timestamp is malformed but regex-shaped', async () => {
    const result = await importLegacyPavilionReservationRows([
      {
        resid: '2025-13-40:99:99:99-bad',
        first: 'First',
        last: 'Last',
        mitid: null,
        email: 'bad-resid@example.com',
        phone: '555',
        affil: 'student',
        groupname: 'Group',
        title: 'Roof deck event',
        acadfac: null,
        acadfacemail: null,
        acct: null,
        date1: '2026-07-01',
        start1: '10:00:00',
        end1: '12:00:00',
        date2: null,
        start2: null,
        end2: null,
        datesel: 1,
        comments: '',
        infotent: 0,
        infoalcohol: 0,
        groupsize: '10',
        active: 1,
        tentative: 0,
        confirmed: 0,
        paid: 0,
        contacted: 1,
      },
    ]);

    expect(result).toEqual({ imported: 1, skipped: 0 });
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('decodes legacy text fields once before import', async () => {
    prisma.$transaction.mockClear();

    const result = await importLegacyPavilionReservationRows([
      {
        resid: '2026-07-01:10:00:00-decode',
        first: 'First',
        last: 'Last',
        mitid: null,
        email: 'decode@example.com',
        phone: '555',
        affil: 'student',
        groupname: 'Group &amp; crew',
        title: 'Roof deck &lt;launch&gt; &amp;lt;literal&amp;gt;',
        acadfac: 'Advisor &#39;Name&#39;',
        acadfacemail: null,
        acct: null,
        date1: '2026-07-01',
        start1: '10:00:00',
        end1: '12:00:00',
        date2: null,
        start2: null,
        end2: null,
        datesel: 1,
        comments: 'Use roof deck &quot;today&quot;',
        infotent: 0,
        infoalcohol: 0,
        groupsize: '10',
        active: 1,
        tentative: 0,
        confirmed: 0,
        paid: 0,
        contacted: 1,
      },
    ]);

    expect(result).toEqual({ imported: 1, skipped: 0 });

    const transactionCallback = prisma.$transaction.mock.calls.at(-1)?.[0];
    if (!transactionCallback) {
      throw new Error('Expected reservation import to start a transaction.');
    }

    const upsert = vi.fn(async () => {
      await Promise.resolve();
      return { id: 'reservation-1' };
    });
    await transactionCallback({
      pavilionReservationRequest: { upsert },
      pavilionReservationSlot: {
        createMany: vi.fn(async () => {
          await Promise.resolve();
          return { count: 1 };
        }),
        deleteMany: vi.fn(async () => {
          await Promise.resolve();
          return { count: 0 };
        }),
      },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          advisorName: "Advisor 'Name'",
          description: 'Use roof deck "today"',
          eventName: 'Roof deck <launch> &lt;literal&gt;',
          groupName: 'Group & crew',
        }),
      })
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
