import { getStaffBySlug } from '@/data/mit-sailing/aboutContent';
import { logger } from '@/libs/Logger';
import {
  aboutPageContentFromSource,
  contentFromGlobal,
} from '@/libs/mit-sailing/aboutPageContent';
import type {
  AboutPageContent,
  AboutStaffCard,
} from '@/libs/mit-sailing/aboutPageContent';
import { ensureAboutContentSeedSafely } from '@/libs/mit-sailing/seedAboutContent';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import type { AboutGlobalSeed } from '@/payload/globals/aboutSeed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function textRows(value: unknown): { text: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }
    return [{ text: fieldString(row, 'text') }];
  });
}

type AboutGlobalSections = {
  dockHours: Record<string, unknown>;
  history: Record<string, unknown>;
  intro: Record<string, unknown>;
  membership: Record<string, unknown>;
  mission: Record<string, unknown>;
  staffSection: Record<string, unknown>;
  volunteer: Record<string, unknown>;
};

function aboutGlobalSectionsFromPayload(
  value: unknown
): AboutGlobalSections | null {
  if (!isRecord(value)) {
    return null;
  }
  const intro = isRecord(value.intro) ? value.intro : null;
  const mission = isRecord(value.mission) ? value.mission : null;
  const membership = isRecord(value.membership) ? value.membership : null;
  const history = isRecord(value.history) ? value.history : null;
  const staffSection = isRecord(value.staffSection) ? value.staffSection : null;
  const volunteer = isRecord(value.volunteer) ? value.volunteer : null;
  const dockHours = isRecord(value.dockHours) ? value.dockHours : null;
  if (
    !intro ||
    !mission ||
    !membership ||
    !history ||
    !staffSection ||
    !volunteer ||
    !dockHours ||
    fieldString(intro, 'title').trim().length === 0
  ) {
    return null;
  }
  return {
    dockHours,
    history,
    intro,
    membership,
    mission,
    staffSection,
    volunteer,
  };
}

function globalFromPayload(value: unknown): AboutGlobalSeed | null {
  const sections = aboutGlobalSectionsFromPayload(value);
  if (!sections) {
    return null;
  }
  const {
    dockHours,
    history,
    intro,
    membership,
    mission,
    staffSection,
    volunteer,
  } = sections;

  const pillars = Array.isArray(mission.pillars) ? mission.pillars : [];
  const options = Array.isArray(membership.options) ? membership.options : [];
  const entries = Array.isArray(history.entries) ? history.entries : [];
  const volunteerSections = Array.isArray(volunteer.sections)
    ? volunteer.sections
    : [];
  const links = Array.isArray(volunteer.links) ? volunteer.links : [];

  return {
    dockHours: {
      disclaimer: fieldString(dockHours, 'disclaimer'),
      helmsman: fieldString(dockHours, 'helmsman'),
      lead: fieldString(dockHours, 'lead'),
      subtitle: fieldString(dockHours, 'subtitle'),
      title: fieldString(dockHours, 'title'),
    },
    history: {
      entries: entries.flatMap((entry) => {
        if (!isRecord(entry)) {
          return [];
        }
        return [
          {
            text: fieldString(entry, 'text'),
            year: fieldString(entry, 'year'),
          },
        ];
      }),
      subtitle: fieldString(history, 'subtitle'),
      supportHref: fieldString(history, 'supportHref'),
      supportLabel: fieldString(history, 'supportLabel'),
      supportText: fieldString(history, 'supportText'),
      title: fieldString(history, 'title'),
    },
    intro: {
      body: fieldString(intro, 'body'),
      title: fieldString(intro, 'title'),
    },
    membership: {
      body: fieldString(membership, 'body'),
      ctaHref: fieldString(membership, 'ctaHref'),
      ctaLabel: fieldString(membership, 'ctaLabel'),
      options: options.flatMap((option) => {
        if (!isRecord(option)) {
          return [];
        }
        return [
          {
            body: fieldString(option, 'body'),
            title: fieldString(option, 'title'),
          },
        ];
      }),
      title: fieldString(membership, 'title'),
    },
    mission: {
      paragraphs: textRows(mission.paragraphs),
      pillars: pillars.flatMap((pillar) => {
        if (!isRecord(pillar)) {
          return [];
        }
        return [
          {
            body: fieldString(pillar, 'body'),
            ctaHref: fieldString(pillar, 'ctaHref'),
            ctaLabel: fieldString(pillar, 'ctaLabel'),
            title: fieldString(pillar, 'title'),
          },
        ];
      }),
      pillarsHeading: fieldString(mission, 'pillarsHeading'),
      subtitle: fieldString(mission, 'subtitle'),
      title: fieldString(mission, 'title'),
    },
    staffSection: {
      subtitle: fieldString(staffSection, 'subtitle'),
      title: fieldString(staffSection, 'title'),
    },
    volunteer: {
      intro: fieldString(volunteer, 'intro'),
      links: links.flatMap((link) => {
        if (!isRecord(link)) {
          return [];
        }
        return [
          {
            href: fieldString(link, 'href'),
            label: fieldString(link, 'label'),
          },
        ];
      }),
      sections: volunteerSections.flatMap((section) => {
        if (!isRecord(section)) {
          return [];
        }
        return [
          {
            body: fieldString(section, 'body'),
            bullets: textRows(section.bullets).map((bullet) => ({
              text: bullet.text,
            })),
            footnote: fieldString(section, 'footnote'),
            title: fieldString(section, 'title'),
          },
        ];
      }),
      title: fieldString(volunteer, 'title'),
    },
  };
}

function staffCard(doc: unknown): AboutStaffCard | null {
  if (!isRecord(doc)) {
    return null;
  }
  const name = fieldString(doc, 'name').trim();
  const role = fieldString(doc, 'role').trim();
  const slug = fieldString(doc, 'slug').trim();
  if (name.length === 0 || role.length === 0 || slug.length === 0) {
    return null;
  }
  const bio = fieldString(doc, 'bio').trim();
  const photo = isRecord(doc.photo) ? doc.photo : null;
  const imageSrc = photo ? fieldString(photo, 'url').trim() : '';
  const imageAlt = photo ? fieldString(photo, 'alt').trim() : '';
  return {
    bio: bio.length > 0 ? bio : undefined,
    imageAlt: imageAlt.length > 0 ? imageAlt : undefined,
    imageSrc: imageSrc.length > 0 ? imageSrc : undefined,
    name,
    role,
    slug,
  };
}

/**
 * About copy and staff cards. Uses the TypeScript source until the global is saved.
 *
 * @returns About page content from Payload or seed fallback
 */
export async function loadAboutPageContent(): Promise<AboutPageContent> {
  await ensureAboutContentSeedSafely();
  try {
    const payload = await getPayloadClient();
    const global = globalFromPayload(
      await payload.findGlobal({
        overrideAccess: false,
        slug: 'about',
      })
    );
    if (!global) {
      return aboutPageContentFromSource();
    }
    const staffResult = await payload.find({
      collection: 'staff',
      depth: 1,
      limit: 100,
      overrideAccess: false,
      sort: 'displayOrder,name',
    });
    const people = staffResult.docs
      .flatMap((doc) => {
        const card = staffCard(doc);
        if (!card || !isRecord(doc)) {
          return [];
        }
        const rawOrder = doc.displayOrder;
        const displayOrder =
          typeof rawOrder === 'number' ? rawOrder : Number(rawOrder);
        return [
          {
            card,
            displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
          },
        ];
      })
      .toSorted(
        (left, right) =>
          left.displayOrder - right.displayOrder ||
          left.card.name.localeCompare(right.card.name)
      )
      .map((row) => row.card);
    return contentFromGlobal(global, people);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load About content: ${message}`);
    return aboutPageContentFromSource();
  }
}

/**
 * Name and role for a staff profile. Missing people stay name-only via the slug.
 *
 * @param slug - Staff slug from the URL
 * @returns Display name and role, or null when unknown
 */
export async function loadStaffProfile(
  slug: string
): Promise<{ name: string; role: string } | null> {
  try {
    const payload = await getPayloadClient();
    const found = await payload.find({
      collection: 'staff',
      depth: 0,
      limit: 1,
      overrideAccess: false,
      where: { slug: { equals: slug } },
    });
    const [staffDoc] = found.docs;
    const card = staffCard(staffDoc);
    if (card) {
      return { name: card.name, role: card.role };
    }
    const count = await payload.count({
      collection: 'staff',
      overrideAccess: false,
    });
    if (count.totalDocs > 0) {
      return null;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load staff profile: ${message}`);
  }
  const seeded = getStaffBySlug(slug);
  if (!seeded) {
    return null;
  }
  return { name: seeded.name, role: seeded.role };
}
