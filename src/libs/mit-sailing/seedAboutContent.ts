import { mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import {
  aboutGlobalSeedData,
  staffSeedRows,
} from '@/payload/globals/aboutSeed';

function isJpeg(bytes: Uint8Array): boolean {
  const [marker0, marker1, marker2] = bytes;
  return marker0 === 0xFF && marker1 === 0xD8 && marker2 === 0xFF;
}

async function downloadJpeg(options: { filename: string; url: string }) {
  const response = await fetch(options.url);
  if (!response.ok) {
    throw new Error(
      `Photo download failed for ${options.filename}: ${response.status}`
    );
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!isJpeg(bytes)) {
    throw new Error(`${options.filename} is not a JPEG.`);
  }
  const directory = path.join(os.tmpdir(), 'mitsailing-staff-photos');
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, options.filename);
  await writeFile(filePath, bytes);
  return filePath;
}

/**
 * Fills the About global and staff cards once, including the two staff photos.
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
    let photo: number | string | undefined;
    if (person.photoFilename.length > 0 && person.imageSrc.length > 0) {
      const media = await payload.find({
        collection: 'media',
        depth: 0,
        limit: 1,
        overrideAccess: true,
        where: { filename: { equals: person.photoFilename } },
      });
      const [existingMedia] = media.docs;
      if (existingMedia) {
        photo = existingMedia.id;
      } else {
        const filePath = await downloadJpeg({
          filename: person.photoFilename,
          url: person.imageSrc,
        });
        const created = await payload.create({
          collection: 'media',
          data: { alt: person.imageAlt },
          filePath,
          overrideAccess: true,
        });
        photo = created.id;
      }
    }
    await payload.create({
      collection: 'staff',
      data: {
        bio: person.bio,
        displayOrder: person.displayOrder,
        name: person.name,
        role: person.role,
        slug: person.slug,
        ...(photo === undefined ? {} : { photo }),
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
