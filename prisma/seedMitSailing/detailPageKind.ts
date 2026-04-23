import type { EventDetailPageKind } from '../../src/generated/prisma/enums';

type SeedKind = 'standard' | 'external' | undefined;

/**
 * Maps optional Figma seed `detail_page_kind` to Prisma enum or `null` when unset.
 *
 * @param k - Raw kind from seed TypeScript, or `undefined` for legacy rows
 * @returns Prisma enum value, or `null` when the row uses the default experience without an explicit kind
 */
export function toDetailPageKind(k: SeedKind): EventDetailPageKind | null {
  if (k === 'external') {
    return 'external';
  }
  if (k === 'standard') {
    return 'standard';
  }
  return null;
}
