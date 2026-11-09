import 'server-only';
import { cache } from 'react';
import { formatMitnaMeetingDateLabel } from '@/data/mit-sailing/mitnaMeetings';
import { ensureMitnaContentSeedSafely } from '@/libs/mit-sailing/seedMitnaContent';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';

export type MitnaMeetingRow = {
  id: string;
  title: string;
  dateYmd: string;
  dateLabel: string;
  link?: string;
};

export type MitnaMeetingsYearGroup = {
  year: number;
  items: MitnaMeetingRow[];
};

function dateYmdFromPayload(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 10);
  }
  return null;
}

async function loadMitnaMeetingsUnchecked(): Promise<MitnaMeetingsYearGroup[]> {
  await ensureMitnaContentSeedSafely();
  const payload = await getPayloadClient();
  const result = await payload.find({
    collection: 'mitna-meetings',
    depth: 0,
    limit: 500,
    overrideAccess: false,
  });

  const rows: MitnaMeetingRow[] = result.docs.flatMap((doc) => {
    const dateYmd = dateYmdFromPayload(doc.date);
    const title = typeof doc.title === 'string' ? doc.title.trim() : '';
    if (!dateYmd || title.length === 0) {
      return [];
    }
    const link =
      typeof doc.link === 'string' && doc.link.trim().length > 0
        ? doc.link.trim()
        : undefined;
    return [
      {
        dateLabel: formatMitnaMeetingDateLabel(dateYmd),
        dateYmd,
        id: String(doc.id),
        link,
        title,
      },
    ];
  });

  rows.sort(
    (left, right) =>
      right.dateYmd.localeCompare(left.dateYmd) ||
      left.title.localeCompare(right.title)
  );

  const byYear = new Map<number, MitnaMeetingRow[]>();
  for (const row of rows) {
    const year = Number(row.dateYmd.slice(0, 4));
    const list = byYear.get(year) ?? [];
    list.push(row);
    byYear.set(year, list);
  }

  return [...byYear.entries()]
    .toSorted((a, b) => b[0] - a[0])
    .map(([year, items]) => ({ year, items }));
}

/**
 * Loads MITNA meetings and groups them by year, newest first.
 */
export const loadMitnaMeetingsByYear = cache(loadMitnaMeetingsUnchecked);
