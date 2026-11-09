import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import {
  aboutGlobalSeedData,
  staffSeedRows,
} from '@/payload/globals/aboutSeed';

/**
 * Fills the About global and staff cards once.
 * Staff photos are uploaded in Payload admin; this seed only creates text rows.
 * The Payload CLI cannot boot under the current Node/tsx pairing, so the first
 * server read performs this seed.
 */
export async function ensureAboutContentSeed(): Promise<void> {
  const payload = await getPayloadClient();
  const global = await payload.findGlobal({
    overrideAccess: true,
    slug: 'about',
  });
  const { intro } = global;
  const introTitle =
    intro && typeof intro === 'object' && 'title' in intro ? intro.title : '';
  if (typeof introTitle !== 'string' || introTitle.trim().length === 0) {
    await payload.updateGlobal({
      data: aboutGlobalSeedData(),
      overrideAccess: true,
      slug: 'about',
    });
  }

  const staffCount = await payload.count({
    collection: 'staff',
    overrideAccess: true,
  });
  if (staffCount.totalDocs > 0) {
    return;
  }

  for (const person of staffSeedRows()) {
    await payload.create({
      collection: 'staff',
      data: {
        bio: person.bio,
        displayOrder: person.displayOrder,
        name: person.name,
        role: person.role,
        slug: person.slug,
      },
      overrideAccess: true,
    });
  }
}

let aboutSeedChecked = false;

/**
 * Runs {@link ensureAboutContentSeed} and logs failures without hiding page copy.
 */
export async function ensureAboutContentSeedSafely(): Promise<void> {
  if (aboutSeedChecked) {
    return;
  }
  try {
    await ensureAboutContentSeed();
    aboutSeedChecked = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed About content: ${message}`);
  }
}
