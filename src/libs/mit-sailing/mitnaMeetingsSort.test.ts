import { describe, expect, it } from 'vitest';

type MeetingRow = {
  dateYmd: string;
  title: string;
};

/**
 * Same sort used after loading Payload meetings: newest date first, then title.
 *
 * @param rows - Meeting rows to sort
 * @returns Rows sorted newest-first, then by title
 */
function sortMitnaMeetings(rows: MeetingRow[]): MeetingRow[] {
  return [...rows].toSorted(
    (left, right) =>
      right.dateYmd.localeCompare(left.dateYmd) ||
      left.title.localeCompare(right.title)
  );
}

describe('mitna meetings sort', () => {
  it('orders by newest date then title', () => {
    expect(
      sortMitnaMeetings([
        { dateYmd: '2025-01-01', title: 'B' },
        { dateYmd: '2026-04-01', title: 'Pavilion Opens' },
        { dateYmd: '2025-01-01', title: 'A' },
      ])
    ).toEqual([
      { dateYmd: '2026-04-01', title: 'Pavilion Opens' },
      { dateYmd: '2025-01-01', title: 'A' },
      { dateYmd: '2025-01-01', title: 'B' },
    ]);
  });
});
