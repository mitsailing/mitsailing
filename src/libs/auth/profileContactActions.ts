'use server';

import { revalidatePath } from 'next/cache';
import { getSession } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';
import {
  normalizeInternationalPhone,
  normalizeUsPhone,
} from '@/utils/phoneValidation';

export type UpdateProfileContactResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'incomplete_emergency_contact'
        | 'invalid_emergency_phone'
        | 'invalid_phone'
        | 'unauthorized';
    };

export async function updateProfileContactAction(
  locale: string,
  input: {
    emergencyContactName: string;
    emergencyContactPhone: string;
    phone: string;
  }
): Promise<UpdateProfileContactResult> {
  const session = await getSession();
  if (!session?.user?.id) {
    return { ok: false, error: 'unauthorized' };
  }

  const phone = normalizeUsPhone(input.phone);
  if (!phone.ok) {
    return { ok: false, error: 'invalid_phone' };
  }

  const emergencyContactName = input.emergencyContactName.trim();
  const rawEmergencyContactPhone = input.emergencyContactPhone.trim();
  if (
    (emergencyContactName.length > 0 &&
      rawEmergencyContactPhone.length === 0) ||
    (emergencyContactName.length === 0 && rawEmergencyContactPhone.length > 0)
  ) {
    return { ok: false, error: 'incomplete_emergency_contact' };
  }

  const emergencyContactPhone =
    rawEmergencyContactPhone.length > 0
      ? normalizeInternationalPhone(rawEmergencyContactPhone)
      : null;
  if (emergencyContactPhone && !emergencyContactPhone.ok) {
    return { ok: false, error: 'invalid_emergency_phone' };
  }

  await prisma.user.update({
    data: {
      emergencyContactName:
        emergencyContactName.length > 0 ? emergencyContactName : null,
      emergencyContactPhone: emergencyContactPhone?.phone ?? null,
      phone: phone.phone,
    },
    where: { id: session.user.id },
  });

  revalidatePath(getI18nPath('/profile', locale));
  return { ok: true };
}
