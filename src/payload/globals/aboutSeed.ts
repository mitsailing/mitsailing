import {
  dockHours,
  EXTERNAL,
  historyBlocks,
  membershipSummary,
  missionBody,
  missionIntro,
  missionPillars,
  staff,
  volunteerIntro,
  volunteerSections,
} from '@/data/mit-sailing/aboutContent';

export type AboutGlobalSeed = {
  dockHours: {
    disclaimer: string;
    helmsman: string;
    lead: string;
    subtitle: string;
    title: string;
  };
  history: {
    entries: { text: string; year: string }[];
    subtitle: string;
    supportHref: string;
    supportLabel: string;
    supportText: string;
    title: string;
  };
  intro: { body: string; title: string };
  membership: {
    body: string;
    ctaHref: string;
    ctaLabel: string;
    options: { body: string; title: string }[];
    title: string;
  };
  mission: {
    paragraphs: { text: string }[];
    pillars: {
      body: string;
      ctaHref: string;
      ctaLabel: string;
      title: string;
    }[];
    pillarsHeading: string;
    subtitle: string;
    title: string;
  };
  staffSection: { subtitle: string; title: string };
  volunteer: {
    intro: string;
    links: { href: string; label: string }[];
    sections: {
      body: string;
      bullets: { text: string }[];
      footnote: string;
      title: string;
    }[];
    title: string;
  };
};

/**
 * About global document used to fill Payload the first time.
 *
 * @returns Seed document for the About Payload global
 */
export function aboutGlobalSeedData(): AboutGlobalSeed {
  return {
    intro: {
      title: 'About MIT Sailing',
      body: missionIntro,
    },
    mission: {
      title: 'Our mission',
      subtitle:
        'How we serve the MIT community and grow lifelong skills on the water.',
      pillarsHeading: 'How we carry out our mission',
      paragraphs: missionBody.map((text) => ({ text })),
      pillars: missionPillars.map((pillar) => ({
        title: pillar.title,
        body: pillar.body,
        ctaLabel: pillar.cta?.label ?? '',
        ctaHref: pillar.cta?.href ?? '',
      })),
    },
    membership: {
      title: membershipSummary.title,
      body: membershipSummary.body,
      ctaLabel: membershipSummary.cta.label,
      ctaHref: membershipSummary.cta.href,
      options: membershipSummary.options.map((option) => ({
        title: option.title,
        body: option.body,
      })),
    },
    history: {
      title: 'History',
      subtitle:
        'From the first college sailing facility to a busy Charles River hub.',
      entries: historyBlocks.map((entry) => ({
        year: entry.year ?? '',
        text: entry.text,
      })),
      supportText:
        'Your support helps maintain the Pavilion, sustain our fleets, and provide opportunities for students, alumni, and the wider community to sail.',
      supportLabel: 'History and giving on MIT Sailing',
      supportHref: EXTERNAL.history,
    },
    staffSection: {
      title: 'Staff',
      subtitle:
        'Meet the people who keep instruction, the fleet, and the dock running.',
    },
    volunteer: {
      title: 'Volunteer',
      intro: volunteerIntro,
      sections: volunteerSections.map((section) => ({
        title: section.title,
        body: section.body,
        bullets: (section.bullets ?? []).map((text) => ({ text })),
        footnote: section.footnote ?? '',
      })),
      links: [
        { label: 'Contact the Pavilion', href: '/contact' },
        { label: 'Calendar and regattas', href: EXTERNAL.calendar },
        { label: 'MITNA Executive Committee', href: '/mitna' },
        { label: 'Volunteer page on MIT Sailing', href: EXTERNAL.volunteer },
      ],
    },
    dockHours: {
      title: 'Dock hours',
      subtitle:
        'Coaching, skills help, and rating tests when volunteers and staff are on the dock.',
      lead: dockHours.lead,
      disclaimer: dockHours.disclaimer,
      helmsman: dockHours.helmsman,
    },
  };
}

/**
 * Staff rows for the first Payload seed. Photos are uploaded in admin later.
 *
 * @returns Staff rows for Payload collection seeding
 */
export function staffSeedRows() {
  return staff.map((person, displayOrder) => ({
    bio: person.bio ?? '',
    displayOrder,
    name: person.name,
    role: person.role,
    slug: person.slug,
  }));
}
