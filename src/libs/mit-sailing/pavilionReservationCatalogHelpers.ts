import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';
import type { PavilionReservableItemDto } from '@/libs/mit-sailing/pavilionReservationTypes';

const PAVILION_REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function referenceCodeFromBytes(bytes: Buffer): string {
  const chars = Array.from(bytes, (byte) => {
    const index = byte % PAVILION_REFERENCE_ALPHABET.length;
    return PAVILION_REFERENCE_ALPHABET[index] ?? 'X';
  }).join('');
  return `PAV-${chars}`;
}

/**
 * Generates a unique pavilion reservation reference code.
 *
 * @param db - Prisma client scoped to reservation writes
 * @returns Unused `PAV-…` reference code
 */
export async function generatePavilionReservationReferenceCode(
  db: Pick<PrismaClient, 'pavilionReservationRequest'>
): Promise<string> {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const referenceCode = referenceCodeFromBytes(randomBytes(8));
    const existing = await db.pavilionReservationRequest.findUnique({
      select: { id: true },
      where: { referenceCode },
    });
    if (!existing) {
      return referenceCode;
    }
  }
  return referenceCodeFromBytes(randomBytes(12));
}

/**
 * Indexes visible catalog items by id for reservation slot/service validation.
 *
 * @param items - Visible pavilion reservable items
 * @returns Map keyed by catalog item id
 */
export function mapPavilionReservableItemsById(
  items: PavilionReservableItemDto[]
): Map<string, PavilionReservableItemDto> {
  return new Map(items.map((item) => [item.id, item]));
}
