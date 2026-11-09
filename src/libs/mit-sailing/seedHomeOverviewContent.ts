import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { homeOverviewGlobalSeedData } from '@/payload/globals/homeOverviewSeed';

/**
 * Fills the home-overview global once when its title is blank.
 * Payload CLI cannot boot under the current Node/tsx pairing, so the first
 * homepage read performs this seed.
 */
export async function ensureHomeOverviewContentSeed(): Promise<void> {
  const payload = await getPayloadClient();
  const global = await payload.findGlobal({
    overrideAccess: true,
    slug: 'home-overview',
  });
  const title = typeof global.title === 'string' ? global.title.trim() : '';
  if (title.length > 0) {
    return;
  }
  await payload.updateGlobal({
    data: homeOverviewGlobalSeedData(),
    overrideAccess: true,
    slug: 'home-overview',
  });
}

let homeOverviewSeedChecked = false;

/**
 * Runs {@link ensureHomeOverviewContentSeed} and logs failures without hiding page copy.
 */
export async function ensureHomeOverviewContentSeedSafely(): Promise<void> {
  if (homeOverviewSeedChecked) {
    return;
  }
  try {
    await ensureHomeOverviewContentSeed();
    homeOverviewSeedChecked = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed home overview content: ${message}`);
  }
}
