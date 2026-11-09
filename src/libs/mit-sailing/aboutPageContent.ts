import { staff } from '@/data/mit-sailing/aboutContent';
import { aboutGlobalSeedData } from '@/payload/globals/aboutSeed';
import type { AboutGlobalSeed } from '@/payload/globals/aboutSeed';

export type AboutLink = {
  href: string;
  label: string;
};

export type AboutStaffCard = {
  bio?: string;
  imageAlt?: string;
  imageSrc?: string;
  name: string;
  role: string;
  slug: string;
};

export type AboutPageContent = {
  dockHoursDisclaimer: string;
  dockHoursHelmsman: string;
  dockHoursLead: string;
  dockHoursSubtitle: string;
  dockHoursTitle: string;
  historyEntries: { text: string; year?: string }[];
  historySubtitle: string;
  historySupport: AboutLink & { text: string };
  historyTitle: string;
  introBody: string;
  introTitle: string;
  membershipBody: string;
  membershipCta: AboutLink;
  membershipOptions: { body: string; title: string }[];
  membershipTitle: string;
  missionParagraphs: string[];
  missionPillars: { body: string; cta?: AboutLink; title: string }[];
  missionPillarsHeading: string;
  missionSubtitle: string;
  missionTitle: string;
  staff: AboutStaffCard[];
  staffSubtitle: string;
  staffTitle: string;
  volunteerIntro: string;
  volunteerLinks: AboutLink[];
  volunteerSections: {
    body: string;
    bullets?: string[];
    footnote?: string;
    title: string;
  }[];
  volunteerTitle: string;
};

function optionalLink(label: string, href: string): AboutLink | undefined {
  const trimmedLabel = label.trim();
  const trimmedHref = href.trim();
  if (trimmedLabel.length === 0 || trimmedHref.length === 0) {
    return undefined;
  }
  return { href: trimmedHref, label: trimmedLabel };
}

function contentFromGlobal(
  global: AboutGlobalSeed,
  people: readonly AboutStaffCard[]
): AboutPageContent {
  return {
    dockHoursDisclaimer: global.dockHours.disclaimer,
    dockHoursHelmsman: global.dockHours.helmsman,
    dockHoursLead: global.dockHours.lead,
    dockHoursSubtitle: global.dockHours.subtitle,
    dockHoursTitle: global.dockHours.title,
    historyEntries: global.history.entries.map((entry) => ({
      text: entry.text,
      year: entry.year.trim().length > 0 ? entry.year : undefined,
    })),
    historySubtitle: global.history.subtitle,
    historySupport: {
      href: global.history.supportHref,
      label: global.history.supportLabel,
      text: global.history.supportText,
    },
    historyTitle: global.history.title,
    introBody: global.intro.body,
    introTitle: global.intro.title,
    membershipBody: global.membership.body,
    membershipCta: {
      href: global.membership.ctaHref,
      label: global.membership.ctaLabel,
    },
    membershipOptions: global.membership.options.map((option) => ({
      body: option.body,
      title: option.title,
    })),
    membershipTitle: global.membership.title,
    missionParagraphs: global.mission.paragraphs.map((row) => row.text),
    missionPillars: global.mission.pillars.map((pillar) => ({
      body: pillar.body,
      cta: optionalLink(pillar.ctaLabel, pillar.ctaHref),
      title: pillar.title,
    })),
    missionPillarsHeading: global.mission.pillarsHeading,
    missionSubtitle: global.mission.subtitle,
    missionTitle: global.mission.title,
    staff: [...people],
    staffSubtitle: global.staffSection.subtitle,
    staffTitle: global.staffSection.title,
    volunteerIntro: global.volunteer.intro,
    volunteerLinks: global.volunteer.links.map((link) => ({
      href: link.href,
      label: link.label,
    })),
    volunteerSections: global.volunteer.sections.map((section) => ({
      body: section.body,
      bullets:
        section.bullets.length > 0
          ? section.bullets.map((bullet) => bullet.text)
          : undefined,
      footnote:
        section.footnote.trim().length > 0 ? section.footnote : undefined,
      title: section.title,
    })),
    volunteerTitle: global.volunteer.title,
  };
}

/**
 * Current About copy before an admin saves the Payload global.
 *
 * @returns About page content from the TypeScript seed source
 */
export function aboutPageContentFromSource(): AboutPageContent {
  return contentFromGlobal(
    aboutGlobalSeedData(),
    staff.map((person) => ({
      bio: person.bio,
      imageAlt: person.imageAlt,
      imageSrc: person.imageSrc,
      name: person.name,
      role: person.role,
      slug: person.slug,
    }))
  );
}

export { contentFromGlobal };
