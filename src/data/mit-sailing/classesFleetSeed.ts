/**
 * Mock curriculum + fleet data. Classes reference event IDs in eventsSeed and boat IDs here;
 * each boat's requiredClassId points at the canonical public class/checkoff shown on fleet pages.
 */

export type ClassCategory =
  | 'introduction'
  | 'windsurfing'
  | 'intro to racing'
  | 'intermediate sailing'
  | 'intermediate racing'
  | 'rating checkoffs'
  | 'bluewater';

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
  isVisible?: boolean;
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
    unlockedBoatIds: ['boat-tech-dinghy'],
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
    unlockedBoatIds: ['boat-tech-dinghy'],
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
    unlockedBoatIds: ['boat-windsurfing'],
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
    unlockedBoatIds: ['boat-laser'],
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
    unlockedBoatIds: [],
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
  {
    id: 'class-provisional-checkoff',
    name: 'Provisional Rating Checkoff',
    slug: 'provisional-rating-checkoff',
    category: 'rating checkoffs',
    level: 'beginner',
    description:
      'Self-study and staff checkoff for safe Tech Dinghy handling on the Charles River, including basic maneuvers, rigging, safety precautions, rules of the road, and dock procedures.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-lynx-catboat', 'boat-laser'],
  },
  {
    id: 'class-crew-rating-self-study',
    name: 'Crew Rating Self-study',
    slug: 'crew-rating-self-study',
    category: 'rating checkoffs',
    level: 'intermediate',
    description:
      'Self-study path for the Crew Rating, covering nautical terminology, seamanship, knots, splices, and the general knowledge expected of MIT sailors.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: [],
  },
  {
    id: 'class-helmsman-checkoff',
    name: 'Helmsman Rating Checkoff',
    slug: 'helmsman-rating-checkoff',
    category: 'rating checkoffs',
    level: 'advanced',
    description:
      'Strong-wind Tech Dinghy checkoff focused on solo upwind sailing, hiking technique, tiller extension use, controlled gybes, and man-overboard recovery.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-flying-junior'],
  },
  {
    id: 'class-lynx-catboat-intro',
    name: 'Intro to Lynx Catboat',
    slug: 'intro-to-lynx-catboat',
    category: 'rating checkoffs',
    level: 'intermediate',
    description:
      'On-boat Lynx Catboat instruction and checkoff covering the gaff rig, mooring work, tacking, gybing, docking, reefing, and safe operation for moonlight sails and harbor-trip preparation.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-lynx-catboat'],
  },
  {
    id: 'class-laser-checkoff',
    name: 'Laser Rating Checkoff',
    slug: 'laser-rating-checkoff',
    category: 'rating checkoffs',
    level: 'advanced',
    description:
      'Laser rigging and boat-handling checkoff for sailors who are comfortable with capsize recovery, tiller extension use, sail controls, and upwind and downwind trim.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-laser'],
  },
  {
    id: 'class-420-checkoff',
    name: '420 Rating Checkoff',
    slug: '420-rating-checkoff',
    category: 'rating checkoffs',
    level: 'advanced',
    description:
      'Club 420 checkoff for sailors ready for double-handed racing boat handling, spinnaker and trapeze preparation, and advanced Charles River sessions.',
    prerequisites: [],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-club-420', 'boat-melges-15'],
  },
  {
    id: 'class-board-sailing-basic-checkoff',
    name: 'Board Sailing Basic Checkoff',
    slug: 'board-sailing-basic-checkoff',
    category: 'windsurfing',
    level: 'intermediate',
    description:
      'Board sailing checkoff for sailors who can rig beginner equipment, tack, and sail upwind in light to medium wind conditions.',
    prerequisites: ['class-windsurfing-fundamentals'],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-windsurfing'],
  },
  {
    id: 'class-board-sailing-advanced-checkoff',
    name: 'Board Sailing Advanced Checkoff',
    slug: 'board-sailing-advanced-checkoff',
    category: 'windsurfing',
    level: 'advanced',
    description:
      'Advanced board sailing checkoff for shaped sails, harness use, tacking, jibing, upwind sailing, and strong-wind conditions.',
    prerequisites: ['class-board-sailing-basic-checkoff'],
    relatedEventIds: [],
    unlockedBoatIds: ['boat-windsurfing'],
  },
  {
    id: 'class-bluewater-crew-pathway',
    name: 'Bluewater Crew Pathway',
    slug: 'bluewater-crew-pathway',
    category: 'bluewater',
    level: 'intermediate',
    description:
      'Mashnee crew leadership pathway for sailors learning coastal sailing, winch operation, sail trim, line handling, mooring, anchoring, navigation, safety, and emergency procedures.',
    prerequisites: [],
    relatedEventIds: ['evt-bluewater-boston-provincetown'],
    unlockedBoatIds: [],
    isVisible: false,
  },
  {
    id: 'class-bluewater-skipper-pathway',
    name: 'Bluewater Skipper Pathway',
    slug: 'bluewater-skipper-pathway',
    category: 'bluewater',
    level: 'advanced',
    description:
      'Mashnee skipper pathway for sailors preparing to schedule trips, direct a crew, understand ship systems, maintain the boat, complete skipper-training cruises, and obtain Sailing Master approval.',
    prerequisites: ['class-bluewater-crew-pathway'],
    relatedEventIds: ['evt-bluewater-boston-provincetown'],
    unlockedBoatIds: ['boat-mashnee'],
    isVisible: false,
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
    id: 'boat-lynx-catboat',
    name: 'Lynx Catboat',
    slug: 'lynx-catboat',
    type: 'gaff-rigged catboat',
    capacity: 8,
    displayOrder: 2,
    requiredClassId: 'class-lynx-catboat-intro',
    description:
      'Wide, stable catboat for groups, moonlight sails, and harbor-trip preparation after the Lynx rating.',
    image: '/images/boats/lynx-catboat.jpg',
  },
  {
    id: 'boat-windsurfing',
    name: 'Windsurfing',
    slug: 'windsurfing',
    type: 'windsurfing',
    capacity: 1,
    displayOrder: 3,
    requiredClassId: 'class-windsurfing-fundamentals',
    description:
      'Windsurfing boards and rigs for sailors with the appropriate board sailing rating.',
    image: '/images/boats/windsurfing.jpg',
  },
  {
    id: 'boat-laser',
    name: 'Laser',
    slug: 'laser',
    type: 'single-handed dinghy',
    capacity: 1,
    displayOrder: 4,
    requiredClassId: 'class-laser-checkoff',
    description:
      'Fast single-handed dinghy that demands confident capsize recovery, trim, and boat handling.',
    image: '/images/boats/laser.jpg',
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
      'Collegiate-standard sloop used by the Sailing Team and advanced sailors.',
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
      'Double-handed racing dinghy for advanced sailors and team practice.',
    image: '/images/boats/club-420-1.jpg',
  },
  {
    id: 'boat-melges-15',
    name: 'Melges 15',
    slug: 'melges-15',
    type: 'double-handed racing dinghy',
    capacity: 2,
    displayOrder: 7,
    requiredClassId: 'class-420-checkoff',
    description:
      'Versatile double-handed racing dinghy with an asymmetric spinnaker. MITNA guidance requires Helmsman, Laser Advanced, or 420 Advanced to sail it.',
    image: '/images/boats/melges-15.jpg',
  },
  {
    id: 'boat-mashnee',
    name: 'Mashnee',
    slug: 'mashnee',
    type: 'bluewater sailboat',
    capacity: 8,
    displayOrder: 8,
    requiredClassId: 'class-intro-sailing-101',
    description:
      'MIT bluewater sailboat berthed in Boston Harbor. A Tech Rating allows members to join sails, while Bluewater Crew and Bluewater Skipper ratings mark leadership and skipper readiness.',
    image: '/images/boats/mashnee.jpg',
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
  'rating checkoffs',
  'bluewater',
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
