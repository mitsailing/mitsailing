'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { adminCatalogResourceAssociationPath } from '@/libs/admin/catalog/adminCatalogPaths';
import type { CatalogResourceId } from '@/libs/admin/catalog/catalogDefinitions';
import { requireAdmin } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import { getI18nPath } from '@/utils/Helpers';

const idSchema = z.string().trim().min(1);

const SAILING_RESOURCE = 'sailing_classes' satisfies CatalogResourceId;

function revalidateAfterSailingClassAssociation(
  locale: string,
  sailingClassId: string
): void {
  revalidatePath(getI18nPath('/donate', locale));
  revalidatePath(getI18nPath('/classes', locale));
  revalidatePath(getI18nPath('/admin', locale));
  revalidatePath(
    getI18nPath(`/admin/sailing_classes/${sailingClassId}/edit`, locale),
    'layout'
  );
  revalidatePath(getI18nPath('/admin/sailing_classes', locale), 'layout');
}

function redirectAssocError(
  locale: string,
  sailingClassId: string,
  segment: string,
  code: string
): never {
  redirect(
    `${getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        segment
      ),
      locale
    )}?error=${encodeURIComponent(code)}`
  );
}

/**
 * Links one published or draft event to a sailing class for the public curriculum.
 *
 * @param locale - Active locale
 * @param sailingClassId - Class primary key
 * @param formData - POST body with `eventId`
 */
export async function addSailingClassRelatedEventAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('eventId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'related-events',
      'validation_failed'
    );
  }
  const eventId = parsed.data;
  try {
    await prisma.sailingClassRelatedEvent.create({
      data: {
        sailingClassId,
        eventId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      redirectAssocError(
        locale,
        sailingClassId,
        'related-events',
        'duplicate_link'
      );
    }
    redirectAssocError(locale, sailingClassId, 'related-events', 'unknown');
  }
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'related-events'
      ),
      locale
    )
  );
}

/**
 * Removes a class ↔ event link.
 *
 * @param locale - Active locale
 * @param sailingClassId - Class primary key
 * @param formData - POST body with `eventId`
 */
export async function removeSailingClassRelatedEventAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('eventId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'related-events',
      'validation_failed'
    );
  }
  await prisma.sailingClassRelatedEvent.deleteMany({
    where: {
      sailingClassId,
      eventId: parsed.data,
    },
  });
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'related-events'
      ),
      locale
    )
  );
}

/**
 * Adds a prerequisite edge ("must complete `prerequisiteClassId` before this class").
 *
 * @param locale - Active locale
 * @param sailingClassId - Dependent class id
 * @param formData - POST body with `prerequisiteClassId`
 */
export async function addSailingClassPrerequisiteAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('prerequisiteClassId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'prerequisites',
      'validation_failed'
    );
  }
  const prerequisiteClassId = parsed.data;
  if (prerequisiteClassId === sailingClassId) {
    redirectAssocError(
      locale,
      sailingClassId,
      'prerequisites',
      'validation_failed'
    );
  }
  try {
    await prisma.sailingClassPrerequisite.create({
      data: {
        sailingClassId,
        prerequisiteClassId,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      redirectAssocError(
        locale,
        sailingClassId,
        'prerequisites',
        'duplicate_link'
      );
    }
    redirectAssocError(locale, sailingClassId, 'prerequisites', 'unknown');
  }
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'prerequisites'
      ),
      locale
    )
  );
}

/**
 * Removes a prerequisite edge.
 *
 * @param locale - Active locale
 * @param sailingClassId - Dependent class id
 * @param formData - POST body with `prerequisiteClassId`
 */
export async function removeSailingClassPrerequisiteAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('prerequisiteClassId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'prerequisites',
      'validation_failed'
    );
  }
  await prisma.sailingClassPrerequisite.deleteMany({
    where: {
      sailingClassId,
      prerequisiteClassId: parsed.data,
    },
  });
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'prerequisites'
      ),
      locale
    )
  );
}

/**
 * Links an unlocked fleet boat to a sailing class.
 *
 * @param locale - Active locale
 * @param sailingClassId - Class primary key
 * @param formData - POST body with `fleetBoatId`
 */
export async function addSailingClassUnlockedBoatAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('fleetBoatId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'unlocked-boats',
      'validation_failed'
    );
  }
  try {
    await prisma.sailingClassUnlockedBoat.create({
      data: {
        sailingClassId,
        fleetBoatId: parsed.data,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      redirectAssocError(
        locale,
        sailingClassId,
        'unlocked-boats',
        'duplicate_link'
      );
    }
    redirectAssocError(locale, sailingClassId, 'unlocked-boats', 'unknown');
  }
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'unlocked-boats'
      ),
      locale
    )
  );
}

/**
 * Removes an unlocked-boat link.
 *
 * @param locale - Active locale
 * @param sailingClassId - Class primary key
 * @param formData - POST body with `fleetBoatId`
 */
export async function removeSailingClassUnlockedBoatAction(
  locale: string,
  sailingClassId: string,
  formData: FormData
): Promise<void> {
  await requireAdmin(locale);
  const parsed = idSchema.safeParse(formData.get('fleetBoatId'));
  if (!parsed.success) {
    redirectAssocError(
      locale,
      sailingClassId,
      'unlocked-boats',
      'validation_failed'
    );
  }
  await prisma.sailingClassUnlockedBoat.deleteMany({
    where: {
      sailingClassId,
      fleetBoatId: parsed.data,
    },
  });
  revalidateAfterSailingClassAssociation(locale, sailingClassId);
  redirect(
    getI18nPath(
      adminCatalogResourceAssociationPath(
        SAILING_RESOURCE,
        sailingClassId,
        'unlocked-boats'
      ),
      locale
    )
  );
}
