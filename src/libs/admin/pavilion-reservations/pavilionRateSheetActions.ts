'use server';

import { revalidatePath } from 'next/cache';
import { ADMIN_INDEX_PATH } from '@/libs/admin/catalog/adminCatalogPaths';
import { savePavilionReservableItemRates } from '@/libs/admin/catalog/pavilionSpacesHandlers';
import { parsePavilionRateSheetSave } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import type { PavilionRateSheetActionState } from '@/libs/admin/pavilion-reservations/pavilionRateSheet';
import { requirePermission } from '@/libs/auth/dal';
import { Permission } from '@/libs/auth/permissions';
import { getI18nPath } from '@/utils/Helpers';

const saveFailed: PavilionRateSheetActionState = {
  errors: [{ id: '', field: 'form', code: 'save_failed' }],
  status: 'error',
};

/**
 * Saves every pavilion audience rate from the rates sheet.
 *
 * @param locale - Active locale
 * @param _previous - Previous action state
 * @param formData - Form body with a JSON `payload`
 * @returns Saved or field-error state
 */
export async function savePavilionRateSheetAction(
  locale: string,
  _previous: PavilionRateSheetActionState,
  formData: FormData
): Promise<PavilionRateSheetActionState> {
  await requirePermission(Permission.PAVILION_RESERVATIONS_MANAGE, locale);

  const raw = formData.get('payload');
  let json: unknown;
  try {
    json = JSON.parse(typeof raw === 'string' ? raw : '');
  } catch {
    return saveFailed;
  }

  const parsed = parsePavilionRateSheetSave(json);
  if (!parsed.ok) {
    return { errors: parsed.errors, status: 'error' };
  }

  const result = await savePavilionReservableItemRates(parsed.rows);
  if (!result.ok) {
    return saveFailed;
  }

  revalidatePath(getI18nPath('/reserve', locale));
  revalidatePath(getI18nPath('/spaces', locale));
  for (const slug of result.slugs) {
    revalidatePath(getI18nPath(`/spaces/${slug}`, locale));
  }
  revalidatePath(getI18nPath(ADMIN_INDEX_PATH, locale));
  revalidatePath(getI18nPath('/admin/pavilion_spaces', locale));

  return { errors: [], status: 'saved' };
}
