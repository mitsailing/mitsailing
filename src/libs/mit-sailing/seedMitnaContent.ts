import {
  mitnaConstitutionHtml,
  mitnaConstitutionHtmlTitle,
} from '@/data/mit-sailing/mitnaConstitutionHtml';
import {
  mitnaHatchAwardHtml,
  mitnaHatchAwardHtmlTitle,
} from '@/data/mit-sailing/mitnaHatchAwardHtml';
import {
  mitnaLandingHtml,
  mitnaLandingHtmlTitle,
} from '@/data/mit-sailing/mitnaLandingHtml';
import { MITNA_MEETING_SEED } from '@/data/mit-sailing/mitnaMeetingSeed';
import { logger } from '@/libs/Logger';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { lexicalFromHtml } from '@/libs/payload/lexicalFromHtml';

const MITNA_PAGE_SEEDS = [
  {
    slug: 'mitna',
    title: mitnaLandingHtmlTitle,
    html: mitnaLandingHtml,
  },
  {
    slug: 'mitna/constitution',
    title: mitnaConstitutionHtmlTitle,
    html: mitnaConstitutionHtml,
  },
  {
    slug: 'mitna/hatch-award',
    title: mitnaHatchAwardHtmlTitle,
    html: mitnaHatchAwardHtml,
  },
] as const;

async function ensureMitnaPage(options: {
  html: string;
  slug: string;
  title: string;
}): Promise<void> {
  const payload = await getPayloadClient();
  const existing = await payload.find({
    collection: 'pages',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    where: {
      or: [
        { slug: { equals: options.slug } },
        { slug: { equals: `/${options.slug}` } },
      ],
    },
  });
  if (existing.docs.length > 0) {
    return;
  }
  const body = await lexicalFromHtml(options.html);
  await payload.create({
    collection: 'pages',
    data: {
      body,
      slug: options.slug,
      title: options.title,
      _status: 'published',
    },
    draft: false,
    overrideAccess: true,
  });
}

async function ensureMitnaMeetingsSeed(): Promise<void> {
  const payload = await getPayloadClient();
  const count = await payload.count({
    collection: 'mitna-meetings',
    overrideAccess: true,
  });
  if (count.totalDocs > 0) {
    return;
  }
  for (const meeting of MITNA_MEETING_SEED) {
    await payload.create({
      collection: 'mitna-meetings',
      data: {
        date: meeting.dateYmd,
        title: meeting.title,
        ...('href' in meeting && meeting.href ? { link: meeting.href } : {}),
      },
      overrideAccess: true,
    });
  }
}

/**
 * Seeds MITNA Payload pages and meetings once when empty.
 */
export async function ensureMitnaContentSeed(): Promise<void> {
  for (const page of MITNA_PAGE_SEEDS) {
    await ensureMitnaPage(page);
  }
  await ensureMitnaMeetingsSeed();
}

let mitnaSeedChecked = false;

/**
 * Runs {@link ensureMitnaContentSeed} and logs failures without hiding page copy.
 */
export async function ensureMitnaContentSeedSafely(): Promise<void> {
  if (mitnaSeedChecked) {
    return;
  }
  try {
    await ensureMitnaContentSeed();
    mitnaSeedChecked = true;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to seed MITNA content: ${message}`);
  }
}
