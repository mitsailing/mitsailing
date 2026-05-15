'use server';

import { revalidatePath } from 'next/cache';
import {
  adminPavilionReservationDetailPath,
  adminPavilionReservationIndexPath,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminPaths';
import {
  adminPavilionReservationStatuses,
  parseAdminPavilionReservationStatus,
} from '@/libs/admin/pavilion-reservations/pavilionReservationAdminQueries';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

function formText(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Updates admin workflow state for one Pavilion reservation request.
 *
 * @param locale - Active locale segment.
 * @param id - Reservation request id.
 * @param formData - Status and notes form payload.
 */
export async function updatePavilionReservationAdminAction(
  locale: string,
  id: string,
  formData: FormData
): Promise<void> {
  const session = await requireAdmin(locale);
  const status = parseAdminPavilionReservationStatus(
    formText(formData, 'status')
  );
  const adminNotes = formText(formData, 'adminNotes');
  if (!status || !adminPavilionReservationStatuses.includes(status)) {
    return;
  }

  await prisma.pavilionReservationRequest.update({
    where: { id },
    data: {
      status,
      adminNotes: adminNotes.length > 0 ? adminNotes : null,
      reviewedAt: new Date(),
      reviewedByUserId: session.user.id,
    },
  });

  revalidatePath(getI18nPath(adminPavilionReservationIndexPath(), locale));
  revalidatePath(getI18nPath(adminPavilionReservationDetailPath(id), locale));
}
