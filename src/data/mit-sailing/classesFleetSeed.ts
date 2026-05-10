/**
 * Mock curriculum + fleet data. Classes reference event IDs in eventsSeed and boat IDs here;
 * each boat's requiredClassId must match the class that lists that boat in unlockedBoatIds.
 */

export type ClassCategory =
  | 'introduction'
  | 'windsurfing'
  | 'intro to racing'
  | 'intermediate sailing'
  | 'intermediate racing';

export type SailingClass = {
  id: string;
  name: string;
  slug: string;
  category: ClassCategory;
  level: string;
  description: string;
  prerequisites: string[];
  relatedEventIds: string[];
  unlockedBoatIds: string[];
};

export type FleetBoat = {
  id: string;
  name: string;
  slug: string;
  type: string;
  capacity: number;
  /** Fleet index / nav order (1-based, contiguous in seed data). */
  displayOrder: number;
  requiredClassId: string;
  description: string;
  image: string;
};

export const SAILING_CLASSES: SailingClass[] = [
  {
    id: 'class-intro-sailing-101',
    name: 'Intro Sailing 101',
    slug: 'intro-sailing-101',
    category: 'introduction',
    level: 'beginner',
    description:
      'First rating path on Tech Dinghies: rigging, tacking, gybing, crew-overboard prep, and Charles River traffic patterns with coach boats alongside.',
    prerequisites: [],
    relatedEventIds: [
      'evt-lts-weekday-apr-7',
      'evt-lts-allinone',
      'evt-dinghy-cup',
    ],
    unlockedBoatIds: ['boat-tech-dinghy'],
  },
  {
    id: 'class-intro-for-experienced',
    name: 'Intro for Experienced Sailors',
    slug: 'intro-for-experienced-sailors',
    category: 'introduction',
    level: 'beginner',
    description:
      'Accelerated checkout for sailors who already know points of sail but need a Charles River orientation, capsize recovery, and fleet rules of the road.',
    prerequisites: [],
    relatedEventIds: [
      'evt-lts-weekday-apr-7',
      'evt-lts-allinone',
      'evt-intermediate-clinic',
    ],
    unlockedBoatIds: ['boat-hunter-140'],
  },
  {
    id: 'class-learn-to-sail-intensive',
    name: 'Learn to Sail — Weekend Intensive',
    slug: 'learn-to-sail-weekend-intensive',
    category: 'introduction',
    level: 'beginner',
    description:
      'Single-weekend immersion: morning chalk talks, afternoon drills, and a supervised short passage plan with debrief.',
    prerequisites: [],
    relatedEventIds: [
      'evt-lts-allinone',
      'evt-lts-weekday-apr-7',
      'evt-boardsailing-weekend',
    ],
    unlockedBoatIds: [],
  },
  {
    id: 'class-windsurfing-fundamentals',
    name: 'Windsurfing Fundamentals',
    slug: 'windsurfing-fundamentals',
    category: 'windsurfing',
    level: 'beginner',
    description:
      'Beach starts, harness line basics, steering on all points, and self-rescue on a stable board rig; small-group coaching in protected water.',
    prerequisites: ['class-intro-sailing-101'],
    relatedEventIds: [
      'evt-boardsailing-weekend',
      'evt-lts-allinone',
      'evt-lts-weekday-apr-7',
    ],
    unlockedBoatIds: ['boat-bic-techno-293'],
  },
  {
    id: 'class-intro-to-racing',
    name: 'Intro to Racing',
    slug: 'intro-to-racing',
    category: 'intro to racing',
    level: 'intermediate',
    description:
      'Starting sequences, laylines, basic rules scenarios (port/starboard, windward mark), and short-course drills in single-handed boats.',
    prerequisites: ['class-intro-sailing-101'],
    relatedEventIds: [
      'evt-racing-rules-clinic',
      'evt-dinghy-cup',
      'evt-lts-weekday-apr-7',
    ],
    unlockedBoatIds: ['boat-laser-radial'],
  },
  {
    id: 'class-intermediate-sailing-skills',
    name: 'Intermediate Sailing — Boat Speed',
    slug: 'intermediate-sailing-boat-speed',
    category: 'intermediate sailing',
    level: 'intermediate',
    description:
      'Sail trim for power and height, crew choreography, roll tacks, and starting-line time-on-distance in a double-handed dinghy.',
    prerequisites: ['class-intro-sailing-101'],
    relatedEventIds: [
      'evt-intermediate-clinic',
      'evt-lts-weekday-apr-7',
      'evt-overnight-series',
    ],
    unlockedBoatIds: ['boat-flying-junior'],
  },
  {
    id: 'class-intermediate-sailing-crew',
    name: 'Intermediate Sailing — Crew & Seamanship',
    slug: 'intermediate-sailing-crew-seamanship',
    category: 'intermediate sailing',
    level: 'intermediate',
    description:
      'Communication, boathandling under pressure, MOB drills from a crewed boat, and docking-style maneuvers in tight river conditions.',
    prerequisites: ['class-intro-sailing-101'],
    relatedEventIds: [
      'evt-intermediate-clinic',
      'evt-lts-allinone',
      'evt-dinghy-cup',
    ],
    unlockedBoatIds: [],
  },
  {
    id: 'class-intermediate-racing-tactics',
    name: 'Intermediate Racing — Tactics & Strategy',
    slug: 'intermediate-racing-tactics-strategy',
    category: 'intermediate racing',
    level: 'advanced',
    description:
      'Shift tracking, fleet positioning, mark traps, and team debriefs using video and GPS tracks from practice races.',
    prerequisites: [
      'class-intro-to-racing',
      'class-intermediate-sailing-skills',
    ],
    relatedEventIds: [
      'evt-dinghy-cup',
      'evt-overnight-series',
      'evt-racing-rules-clinic',
    ],
    unlockedBoatIds: ['boat-club-420'],
  },
];

export const FLEET_BOATS: FleetBoat[] = [
  {
    id: 'boat-tech-dinghy',
    name: 'Tech Dinghy',
    slug: 'tech-dinghy',
    type: 'training dinghy',
    capacity: 2,
    displayOrder: 1,
    requiredClassId: 'class-intro-sailing-101',
    description:
      'Stable club trainer for the Charles; forgiving hull form for first ratings and light-air drills.',
    image: '/images/boats/tech-dinghy-1.jpg',
  },
  {
    id: 'boat-hunter-140',
    name: 'Hunter 140',
    slug: 'hunter-140',
    type: 'small daysailer',
    capacity: 4,
    displayOrder: 2,
    requiredClassId: 'class-intro-for-experienced',
    description:
      'Slightly larger platform for sailors transitioning from other venues; emphasizes crew roles and river communication.',
    image: '/images/boats/hunter-140.jpg',
  },
  {
    id: 'boat-bic-techno-293',
    name: 'BIC Techno 293 OD',
    slug: 'bic-techno-293',
    type: 'windsurfer',
    capacity: 1,
    displayOrder: 3,
    requiredClassId: 'class-windsurfing-fundamentals',
    description:
      'Durable learner board with adjustable daggerboard; tuned for first planing attempts in moderate breeze.',
    image: '/images/boats/bic-techno-1.jpg',
  },
  {
    id: 'boat-laser-radial',
    name: 'Laser Radial',
    slug: 'laser-radial',
    type: 'single-handed dinghy',
    capacity: 1,
    displayOrder: 4,
    requiredClassId: 'class-intro-to-racing',
    description:
      'Responsive hull for rules-of-the-road drills and short-course racing; radial rig for a wide sailor weight range.',
    image: '/images/boats/laser-radial.jpg',
  },
  {
    id: 'boat-flying-junior',
    name: 'Flying Junior (FJ)',
    slug: 'flying-junior',
    type: 'double-handed dinghy',
    capacity: 2,
    displayOrder: 5,
    requiredClassId: 'class-intermediate-sailing-skills',
    description:
      'Collegiate-standard sloop for coordinated trim and asymmetric boathandling fundamentals (no spin on this progression step).',
    image: '/images/boats/flying-junior-1.jpg',
  },
  {
    id: 'boat-club-420',
    name: 'Club 420',
    slug: 'club-420',
    type: 'double-handed racing dinghy',
    capacity: 2,
    displayOrder: 6,
    requiredClassId: 'class-intermediate-racing-tactics',
    description:
      'Spinnaker and trapeze introduction for sailors cleared for advanced river sessions and evening series.',
    image: '/images/boats/club-420-1.jpg',
  },
];

export function getSailingClassBySlug(slug: string): SailingClass | undefined {
  return SAILING_CLASSES.find((c) => c.slug === slug);
}

export function getSailingClassById(id: string): SailingClass | undefined {
  return SAILING_CLASSES.find((c) => c.id === id);
}

export function getFleetBoatBySlug(slug: string): FleetBoat | undefined {
  return FLEET_BOATS.find((b) => b.slug === slug);
}

export function getFleetBoatById(id: string): FleetBoat | undefined {
  return FLEET_BOATS.find((b) => b.id === id);
}

const CATEGORY_ORDER: ClassCategory[] = [
  'introduction',
  'windsurfing',
  'intro to racing',
  'intermediate sailing',
  'intermediate racing',
];

export function groupClassesByCategory(
  classes: SailingClass[]
): { category: ClassCategory; classes: SailingClass[] }[] {
  const map = new Map<ClassCategory, SailingClass[]>();
  for (const c of classes) {
    if (!map.has(c.category)) {
      map.set(c.category, []);
    }
    map.get(c.category)!.push(c);
  }
  return CATEGORY_ORDER.filter((cat) => map.has(cat)).map((category) => ({
    category,
    classes: map.get(category)!,
  }));
}
