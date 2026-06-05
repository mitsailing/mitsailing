/**
 * Canonical catalog + seed data for the MIT Sailing app (events, registrations, etc.).
 * Loaded by `prisma/seedMitSailing.ts` and by server code that should read the same
 * shape as the database (Cal.com-style: one typed source, Prisma is runtime truth after seed).
 */
import {
  addNyCalendarDays,
  instantForNyWallClock,
  nyYmd,
} from '@/lib/mit-sailing/nyTime';

export type EventCategory = {
  id: string;
  name: string;
  display_order: number;
  is_visible: boolean;
  created_at: string;
  /** Tailwind `bg-*` for calendar/home category bar; omit for default tint. */
  accent_class_name?: string | null;
};

export type AnswerType = 'text' | 'select' | 'checkbox';

/** How the public detail experience is served (legacy “custom vs standard web page”). */
export type EventDetailPageKind = 'standard' | 'external';
export type EventRegistrationMode = 'none' | 'standard' | 'external';
export type LearnToSailManagedClassKind =
  | 'none'
  | 'beginner_mid_week_123'
  | 'beginner_sunday_all_in_one';

export type Event = {
  id: string;
  name: string;
  short_name: string;
  event_category_id: string;
  description: string;
  slug: string;
  is_special: boolean;
  max_participants: number | null;
  requires_approval: boolean;
  registration_start: string | null;
  registration_end: string | null;
  created_at: string;
  /**
   * Standard = this app’s `/events/:slug` page. External = members follow a
   * custom URL (club site, Google Doc, etc.). Optional on older seed rows.
   */
  detail_page_kind?: EventDetailPageKind;
  /** When `detail_page_kind` is `external`, destination URL (https…). */
  external_detail_url?: string | null;
  registration_mode?: EventRegistrationMode;
  learn_to_sail_managed_class_kind?: LearnToSailManagedClassKind;
  selection_note?: string | null;
  /**
   * When false, the event is hidden from the public calendar and registration
   * is disabled; the `/events/:slug` URL still works for anyone with the link.
   */
  is_published: boolean;
};

export type EventDate = {
  id: string;
  eventId: string;
  start_datetime: string;
  end_datetime: string;
};

export type StubUser = {
  id: string;
  name: string;
  email: string;
  initials: string;
};

export type EventAdmin = {
  id: string;
  event_id: string;
  admin_user_id: string;
};

export type EventRegistrationStatus = 'pending' | 'approved' | 'cancelled';

export type EventRegistration = {
  id: string;
  event_id: string;
  user_id: string;
  status: EventRegistrationStatus;
  created_at: string;
  /**
   * Timestamp of the universal swim agreement acceptance.
   * Pavilion policy: no user may register for ANY event without accepting the
   * swim agreement at the moment of registration, so this is required (non-null).
   */
  swim_agreement_accepted_at: string;
};

/**
 * Stored answers to event-scoped custom registration questions. One row per
 * (registration, question). Intentionally separate from any other form-answer
 * system (membership forms, class intake, etc.) so the schema can evolve
 * independently.
 */
export type EventRegistrationAnswer = {
  id: string;
  registration_id: string;
  question_id: string;
  /** Normalized to string: "yes"/"no" for checkbox, option label for select. */
  value: string;
};

export type EventRegistrationQuestion = {
  id: string;
  event_id: string;
  question_text: string;
  answer_type: AnswerType;
  options?: string[];
  required: boolean;
  display_order: number;
};

export type EventEntryFee = {
  id: string;
  event_id: string;
  description: string;
  amount_cents: number;
  is_deposit: boolean;
};

export type EventComment = {
  id: string;
  event_id: string;
  parent_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
};

const NOW_ISO = '2026-01-15T12:00:00.000Z';

/* -------------------------------------------------------------------------- */
/* Stub users (a tiny local directory; real app would pull from users table). */
/* -------------------------------------------------------------------------- */

export const STUB_USERS: StubUser[] = [
  {
    id: 'username',
    name: 'Username',
    email: 'username@example.com',
    initials: 'U',
  },
  {
    id: 'user-tbarros',
    name: 'Teresa Barros',
    email: 'tbarros@mit.edu',
    initials: 'TB',
  },
  {
    id: 'user-fritz',
    name: 'Fritz Koenig',
    email: 'fritz@mit.edu',
    initials: 'FK',
  },
  {
    id: 'user-mlopez',
    name: 'Maria Lopez',
    email: 'mlopez@mit.edu',
    initials: 'ML',
  },
  {
    id: 'user-jchen',
    name: 'Jordan Chen',
    email: 'jchen@mit.edu',
    initials: 'JC',
  },
  {
    id: 'user-spark',
    name: 'Sam Park',
    email: 'spark@mit.edu',
    initials: 'SP',
  },
  {
    id: 'user-rstein',
    name: 'Riya Steinberg',
    email: 'rstein@mit.edu',
    initials: 'RS',
  },
  {
    id: 'user-dnguyen',
    name: 'Diego Nguyen',
    email: 'dnguyen@mit.edu',
    initials: 'DN',
  },
  {
    id: 'user-ehwang',
    name: 'Emma Hwang',
    email: 'ehwang@mit.edu',
    initials: 'EH',
  },
  {
    id: 'user-pwilson',
    name: 'Priya Wilson',
    email: 'pwilson@mit.edu',
    initials: 'PW',
  },
];

export function getStubUserById(id: string): StubUser | undefined {
  return STUB_USERS.find((u) => u.id === id);
}

export function resolveEventDetailPageKind(e: Event): EventDetailPageKind {
  return e.detail_page_kind ?? 'standard';
}

/** Published events appear on `/events`; unpublished are link-only with no registration. */
export function isEventPublished(event: Event): boolean {
  return event.is_published;
}

/** Calendar navigation bounds consider only dates belonging to published events. */
export function getPublishedCatalogMonthBounds(publishedEvents: Event[]): {
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
} {
  const ids = new Set(publishedEvents.map((e) => e.id));
  let minKey = '9999-12-31';
  let maxKey = '0000-01-01';
  let any = false;
  for (const ed of GLOBAL_EVENT_DATES) {
    if (!ids.has(ed.eventId)) {
      continue;
    }
    any = true;
    const s = nyYmd(new Date(ed.start_datetime));
    const e = nyYmd(new Date(ed.end_datetime));
    if (s < minKey) {
      minKey = s;
    }
    if (e > maxKey) {
      maxKey = e;
    }
  }
  if (!any) {
    const today = nyYmd(new Date());
    minKey = today;
    maxKey = today;
  }
  const minParts = ymdToYearMonth(minKey);
  const maxParts = ymdToYearMonth(maxKey);
  return {
    minYear: minParts.year,
    minMonth: minParts.month,
    maxYear: maxParts.year,
    maxMonth: maxParts.month,
  };
}

/** Hard-coded stub viewer. In a real app this comes from the auth session. */
export const CURRENT_USER_ID = 'username';

/* -------------------------------------------------------------------------- */
/* Event categories — 11 MITNA categories in display order (1-indexed).       */
/* -------------------------------------------------------------------------- */

export const EVENT_CATEGORIES: EventCategory[] = [
  {
    id: 'cat-bluewater',
    name: 'Bluewater',
    display_order: 1,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-dock-hours',
    name: 'Dock Hours',
    display_order: 2,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-harbor-trips',
    name: 'Harbor Trips',
    display_order: 3,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-learn-to-series',
    name: 'Learn-to-Series',
    display_order: 4,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-success',
  },
  {
    id: 'cat-mitna-meetings',
    name: 'MITNA Meetings',
    display_order: 5,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-mitna-racing',
    name: 'MITNA Racing',
    display_order: 6,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-red',
  },
  {
    id: 'cat-mitna-regatta',
    name: 'MITNA Regatta',
    display_order: 7,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-red',
  },
  {
    id: 'cat-moonlight-sailing',
    name: 'Moonlight Sailing',
    display_order: 8,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-pe-class',
    name: 'PE Class',
    display_order: 9,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-success',
  },
  {
    id: 'cat-private-event',
    name: 'Private Event',
    display_order: 10,
    is_visible: false,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-cat',
  },
  {
    id: 'cat-sailing-team',
    name: 'Sailing Team',
    display_order: 11,
    is_visible: true,
    created_at: NOW_ISO,
    accent_class_name: 'bg-mit-red',
  },
];

/* -------------------------------------------------------------------------- */
/* Events — the legacy entries remapped to new MITNA categories + 3 new demos. */
/* -------------------------------------------------------------------------- */

export const EVENTS: Event[] = [
  {
    id: 'evt-dinghy-cup',
    name: 'Boston Dinghy Cup',
    short_name: 'Dinghy Cup',
    event_category_id: 'cat-mitna-regatta',
    description:
      'Limited recreational boats during the regatta; check the dock board for closures. Two-day regatta co-hosted with neighboring college programs; volunteers welcome.',
    slug: 'boston-dinghy-cup',
    is_special: true,
    max_participants: 48,
    requires_approval: true,
    registration_start: '2026-05-01T04:00:00.000Z',
    registration_end: '2026-06-12T03:59:59.000Z',
    created_at: '2026-01-05T14:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-lts-allinone',
    name: 'Learn to Sail Class - All-in-One',
    short_name: 'Learn-to-Sail All-in-One',
    event_category_id: 'cat-learn-to-series',
    description:
      "Beginner-friendly full day covering rigging, points of sail, and supervised practice. Life jackets and boats provided — bring clothes you don't mind getting wet.",
    slug: 'learn-to-sail-all-in-one',
    is_special: false,
    max_participants: 20,
    requires_approval: false,
    registration_start: '2026-03-01T05:00:00.000Z',
    registration_end: '2026-09-04T03:59:59.000Z',
    created_at: '2026-01-06T15:00:00.000Z',
    is_published: true,
  },
  /**
   * Learn to Sail Class 1-2-3 runs as an independent 3-day cohort (Tue/Wed/Thu).
   * Each week is its own event with its own slug and its own registrations —
   * the dates stay in event date rows, matching the legacy schema shape.
   */
  {
    id: 'evt-lts-weekday-apr-7',
    name: 'Learn to Sail Class - Tech Dinghy for Beginners',
    short_name: 'Learn-to-Sail Class 1-2-3',
    event_category_id: 'cat-pe-class',
    description:
      'Three consecutive afternoon sessions (Tue/Wed/Thu) on Tech Dinghies; life jackets provided. Counts toward a provisional rating.',
    slug: 'learn-to-sail-weekday-apr-7',
    is_special: false,
    max_participants: 12,
    requires_approval: false,
    registration_start: '2026-03-15T04:00:00.000Z',
    registration_end: '2026-04-06T03:59:59.000Z',
    created_at: '2026-01-06T15:05:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-lts-weekday-apr-14',
    name: 'Learn to Sail Class - Tech Dinghy for Beginners',
    short_name: 'Learn-to-Sail Class 1-2-3',
    event_category_id: 'cat-pe-class',
    description:
      'Three consecutive afternoon sessions (Tue/Wed/Thu) on Tech Dinghies; life jackets provided. Counts toward a provisional rating.',
    slug: 'learn-to-sail-weekday-apr-14',
    is_special: false,
    max_participants: 18,
    requires_approval: true,
    registration_start: '2026-06-01T04:00:00.000Z',
    registration_end: '2030-06-30T03:59:59.000Z',
    learn_to_sail_managed_class_kind: 'beginner_mid_week_123',
    selection_note: 'Decisions Monday afternoon',
    created_at: '2026-01-06T15:05:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-lts-weekday-apr-21',
    name: 'Learn to Sail Class - Tech Dinghy for Beginners',
    short_name: 'Learn-to-Sail Class 1-2-3',
    event_category_id: 'cat-pe-class',
    description:
      'Three consecutive afternoon sessions (Tue/Wed/Thu) on Tech Dinghies; life jackets provided. Counts toward a provisional rating.',
    slug: 'learn-to-sail-weekday-apr-21',
    is_special: false,
    max_participants: 12,
    requires_approval: false,
    registration_start: '2026-03-29T04:00:00.000Z',
    registration_end: '2026-04-20T03:59:59.000Z',
    created_at: '2026-01-06T15:05:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-overnight-series',
    name: 'Intercollegiate Overnight Series',
    short_name: 'Overnight Series',
    event_category_id: 'cat-mitna-racing',
    description:
      'Evening starts with finishes the following afternoon; rotation schedule posted at the dock.',
    slug: 'intercollegiate-overnight-series',
    is_special: false,
    max_participants: 24,
    requires_approval: true,
    registration_start: '2026-04-01T04:00:00.000Z',
    registration_end: '2026-09-03T03:59:59.000Z',
    created_at: '2026-01-07T13:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-intermediate-clinic',
    name: 'Intermediate Sailing Clinic',
    short_name: 'Intermediate Clinic',
    event_category_id: 'cat-learn-to-series',
    description:
      'For sailors with a provisional rating; drills on boat speed, tacks, and crew coordination.',
    slug: 'intermediate-sailing-clinic',
    is_special: false,
    max_participants: 16,
    requires_approval: false,
    registration_start: '2026-05-01T04:00:00.000Z',
    registration_end: '2026-06-06T03:59:59.000Z',
    created_at: '2026-01-08T13:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-boardsailing-weekend',
    name: 'Boardsailing / Windsurfing Weekend Blocks',
    short_name: 'Boardsailing Blocks',
    event_category_id: 'cat-learn-to-series',
    description:
      'Half-day blocks on learner boards and rigs; harness intro and self-rescue in protected water.',
    slug: 'boardsailing-windsurfing-weekend-blocks',
    is_special: false,
    max_participants: 10,
    requires_approval: false,
    registration_start: '2026-04-15T04:00:00.000Z',
    registration_end: '2026-05-16T03:59:59.000Z',
    created_at: '2026-01-09T14:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-racing-rules-clinic',
    name: 'Racing Rules & Starting Clinic',
    short_name: 'Racing Rules Clinic',
    event_category_id: 'cat-mitna-racing',
    description:
      'Port/starboard and windward mark scenarios, practice starts, and short-course debriefs with coaches.',
    slug: 'racing-rules-starting-clinic',
    is_special: false,
    max_participants: 24,
    requires_approval: false,
    registration_start: '2026-04-01T04:00:00.000Z',
    registration_end: '2026-05-05T03:59:59.000Z',
    created_at: '2026-01-10T13:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-bluewater-boston-provincetown',
    name: 'Bluewater: Boston to Provincetown Passage',
    short_name: 'P-town Passage',
    event_category_id: 'cat-bluewater',
    description:
      'Two-day overnight passage to Provincetown and back. Required gear list provided on registration. Crew selected from approved bluewater sailors; instructor approval required.',
    slug: 'bluewater-boston-provincetown',
    is_special: true,
    max_participants: 8,
    requires_approval: true,
    registration_start: '2026-04-01T04:00:00.000Z',
    registration_end: '2026-07-01T03:59:59.000Z',
    created_at: '2026-01-11T12:30:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-moonlight-july',
    name: 'July Moonlight Sail',
    short_name: 'July Moonlight',
    event_category_id: 'cat-moonlight-sailing',
    description:
      'Casual evening sail under the full moon. Bring a warm layer. Provisional rating or higher required; no prior signup for a first-time guest needed — just come down to the dock.',
    slug: 'july-moonlight-sail',
    is_special: false,
    max_participants: 24,
    requires_approval: false,
    registration_start: '2026-06-01T04:00:00.000Z',
    registration_end: '2026-07-19T03:59:59.000Z',
    created_at: '2026-01-12T16:00:00.000Z',
    is_published: true,
  },
  {
    id: 'evt-mitna-spring-meeting',
    name: 'MITNA Spring General Meeting',
    short_name: 'Spring GM',
    event_category_id: 'cat-mitna-meetings',
    description:
      'Quarterly general meeting. Officer updates, budget review, upcoming season preview, and open floor. Pizza provided after the meeting.',
    slug: 'mitna-spring-general-meeting',
    is_special: false,
    max_participants: 60,
    requires_approval: false,
    registration_start: '2026-02-01T05:00:00.000Z',
    registration_end: '2026-03-11T03:59:59.000Z',
    created_at: '2026-01-13T18:00:00.000Z',
    is_published: true,
  },
];

function toIso(d: Date): string {
  return d.toISOString();
}

/** Parses `YYYY-MM-DD` to year and month; throws if malformed. */
function ymdToYearMonth(ymd: string): { year: number; month: number } {
  const [year, month] = ymd.split('-').map(Number);
  if (year === undefined || month === undefined) {
    throw new TypeError(`Invalid YMD for year/month: ${ymd}`);
  }
  return { year, month };
}

function ymdParts(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new TypeError(`Invalid YMD: ${ymd}`);
  }
  return [y, m, d];
}

function pushRow(
  rows: EventDate[],
  id: string,
  eventId: string,
  startYmd: string,
  sh: number,
  sm: number,
  endYmd: string,
  eh: number,
  em: number
): void {
  const [ys, ms, ds] = ymdParts(startYmd);
  const [ye, me, de] = ymdParts(endYmd);
  const start = instantForNyWallClock(ys, ms, ds, sh, sm);
  const end = instantForNyWallClock(ye, me, de, eh, em);
  rows.push({
    id,
    eventId,
    start_datetime: toIso(start),
    end_datetime: toIso(end),
  });
}

/**
 * Scheduled occurrences: each row is an explicit New York calendar date and
 * wall time (`instantForNyWallClock`). Edit `pushRow` entries to change the calendar.
 */
function buildCatalogEventDates(): EventDate[] {
  const rows: EventDate[] = [];

  /* Learn-to-Sail Class 1-2-3 cohorts (5:30–7:30 pm ET, Tue/Wed/Thu). */
  /* Cohort 1 — Apr 7, 8, 9 (Tue, Wed, Thu) */
  pushRow(
    rows,
    'ed-lts-wd-2026-04-07',
    'evt-lts-weekday-apr-7',
    '2026-04-07',
    17,
    30,
    '2026-04-07',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-08',
    'evt-lts-weekday-apr-7',
    '2026-04-08',
    17,
    30,
    '2026-04-08',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-09',
    'evt-lts-weekday-apr-7',
    '2026-04-09',
    17,
    30,
    '2026-04-09',
    19,
    30
  );
  /* Cohort 2 — Apr 14, 15, 16 */
  pushRow(
    rows,
    'ed-lts-wd-2026-04-14',
    'evt-lts-weekday-apr-14',
    '2026-04-14',
    17,
    30,
    '2026-04-14',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-15',
    'evt-lts-weekday-apr-14',
    '2026-04-15',
    17,
    30,
    '2026-04-15',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-16',
    'evt-lts-weekday-apr-14',
    '2026-04-16',
    17,
    30,
    '2026-04-16',
    19,
    30
  );
  /* Cohort 3 — Apr 21, 22, 23 */
  pushRow(
    rows,
    'ed-lts-wd-2026-04-21',
    'evt-lts-weekday-apr-21',
    '2026-04-21',
    17,
    30,
    '2026-04-21',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-22',
    'evt-lts-weekday-apr-21',
    '2026-04-22',
    17,
    30,
    '2026-04-22',
    19,
    30
  );
  pushRow(
    rows,
    'ed-lts-wd-2026-04-23',
    'evt-lts-weekday-apr-21',
    '2026-04-23',
    17,
    30,
    '2026-04-23',
    19,
    30
  );

  /* Learn-to-Sail All-in-One (9:45 am–3:30 pm ET) */
  pushRow(
    rows,
    'ed-lts-ai-2026-05-16',
    'evt-lts-allinone',
    '2026-05-16',
    9,
    45,
    '2026-05-16',
    15,
    30
  );
  pushRow(
    rows,
    'ed-lts-ai-2026-07-11',
    'evt-lts-allinone',
    '2026-07-11',
    9,
    45,
    '2026-07-11',
    15,
    30
  );
  pushRow(
    rows,
    'ed-lts-ai-2026-09-05',
    'evt-lts-allinone',
    '2026-09-05',
    9,
    45,
    '2026-09-05',
    15,
    30
  );

  /* Boston Dinghy Cup (9 am–5 pm ET, two days) */
  pushRow(
    rows,
    'ed-dinghy-2026-06-13',
    'evt-dinghy-cup',
    '2026-06-13',
    9,
    0,
    '2026-06-13',
    17,
    0
  );
  pushRow(
    rows,
    'ed-dinghy-2026-06-14',
    'evt-dinghy-cup',
    '2026-06-14',
    9,
    0,
    '2026-06-14',
    17,
    0
  );

  /* Intercollegiate Overnight Series (Thu 7 pm → Fri 5 pm ET) */
  pushRow(
    rows,
    'ed-overnight-2026-05-14',
    'evt-overnight-series',
    '2026-05-14',
    19,
    0,
    '2026-05-15',
    17,
    0
  );
  pushRow(
    rows,
    'ed-overnight-2026-09-03',
    'evt-overnight-series',
    '2026-09-03',
    19,
    0,
    '2026-09-04',
    17,
    0
  );

  /* Intermediate Sailing Clinic (9:30 am–12:30 pm ET) */
  pushRow(
    rows,
    'ed-clinic-2026-06-07',
    'evt-intermediate-clinic',
    '2026-06-07',
    9,
    30,
    '2026-06-07',
    12,
    30
  );
  pushRow(
    rows,
    'ed-clinic-2026-10-04',
    'evt-intermediate-clinic',
    '2026-10-04',
    9,
    30,
    '2026-10-04',
    12,
    30
  );

  /* Boardsailing / Windsurfing Weekend Blocks (9 am–1 pm ET) */
  pushRow(
    rows,
    'ed-boardsail-2026-05-17',
    'evt-boardsailing-weekend',
    '2026-05-17',
    9,
    0,
    '2026-05-17',
    13,
    0
  );
  pushRow(
    rows,
    'ed-boardsail-2026-08-09',
    'evt-boardsailing-weekend',
    '2026-08-09',
    9,
    0,
    '2026-08-09',
    13,
    0
  );
  pushRow(
    rows,
    'ed-boardsail-2026-10-11',
    'evt-boardsailing-weekend',
    '2026-10-11',
    9,
    0,
    '2026-10-11',
    13,
    0
  );

  /* Racing Rules & Starting Clinic (6–8:30 pm ET) */
  pushRow(
    rows,
    'ed-racing-clinic-2026-05-06',
    'evt-racing-rules-clinic',
    '2026-05-06',
    18,
    0,
    '2026-05-06',
    20,
    30
  );
  pushRow(
    rows,
    'ed-racing-clinic-2026-07-15',
    'evt-racing-rules-clinic',
    '2026-07-15',
    18,
    0,
    '2026-07-15',
    20,
    30
  );
  pushRow(
    rows,
    'ed-racing-clinic-2026-09-09',
    'evt-racing-rules-clinic',
    '2026-09-09',
    18,
    0,
    '2026-09-09',
    20,
    30
  );

  /* Bluewater: Boston → Provincetown (multi-day passage) */
  pushRow(
    rows,
    'ed-bluewater-2026-07-18',
    'evt-bluewater-boston-provincetown',
    '2026-07-18',
    6,
    0,
    '2026-07-19',
    20,
    0
  );
  pushRow(
    rows,
    'ed-bluewater-2026-08-22',
    'evt-bluewater-boston-provincetown',
    '2026-08-22',
    6,
    0,
    '2026-08-23',
    20,
    0
  );

  /* July Moonlight Sail (8 pm – 10 pm ET) */
  pushRow(
    rows,
    'ed-moonlight-2026-07-20',
    'evt-moonlight-july',
    '2026-07-20',
    20,
    0,
    '2026-07-20',
    22,
    0
  );

  /* MITNA Spring General Meeting (6:30 pm – 8 pm ET) */
  pushRow(
    rows,
    'ed-mitna-spring-2026-03-12',
    'evt-mitna-spring-meeting',
    '2026-03-12',
    18,
    30,
    '2026-03-12',
    20,
    0
  );

  return rows;
}

/**
 * Catalog event date rows (ISO instants). The live app reads these from PostgreSQL
 * after `prisma db seed`; this array remains the canonical shape for seed + tests.
 */
export const GLOBAL_EVENT_DATES: EventDate[] = buildCatalogEventDates();

/* -------------------------------------------------------------------------- */
/* Event admins — who can manage registrations / receive admin emails.        */
/* -------------------------------------------------------------------------- */

export const EVENT_ADMINS: EventAdmin[] = [
  {
    id: 'ea-dinghy-1',
    event_id: 'evt-dinghy-cup',
    admin_user_id: 'user-tbarros',
  },
  {
    id: 'ea-dinghy-2',
    event_id: 'evt-dinghy-cup',
    admin_user_id: 'user-mlopez',
  },
  {
    id: 'ea-lts-ai-1',
    event_id: 'evt-lts-allinone',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-lts-wd-1-apr-7',
    event_id: 'evt-lts-weekday-apr-7',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-lts-wd-1-apr-14',
    event_id: 'evt-lts-weekday-apr-14',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-lts-wd-1-apr-21',
    event_id: 'evt-lts-weekday-apr-21',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-overnight-1',
    event_id: 'evt-overnight-series',
    admin_user_id: 'user-tbarros',
  },
  {
    id: 'ea-clinic-1',
    event_id: 'evt-intermediate-clinic',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-board-1',
    event_id: 'evt-boardsailing-weekend',
    admin_user_id: 'user-mlopez',
  },
  {
    id: 'ea-rrc-1',
    event_id: 'evt-racing-rules-clinic',
    admin_user_id: 'user-tbarros',
  },
  {
    id: 'ea-bluewater-1',
    event_id: 'evt-bluewater-boston-provincetown',
    admin_user_id: 'user-tbarros',
  },
  {
    id: 'ea-bluewater-2',
    event_id: 'evt-bluewater-boston-provincetown',
    admin_user_id: 'user-fritz',
  },
  {
    id: 'ea-moonlight-1',
    event_id: 'evt-moonlight-july',
    admin_user_id: 'user-mlopez',
  },
  {
    id: 'ea-spring-gm-1',
    event_id: 'evt-mitna-spring-meeting',
    admin_user_id: 'user-tbarros',
  },
  {
    id: 'ea-spring-gm-2',
    event_id: 'evt-mitna-spring-meeting',
    admin_user_id: 'username',
  },
];

/* -------------------------------------------------------------------------- */
/* Event registration questions — admin-authored custom fields per event.      */
/* -------------------------------------------------------------------------- */

export const EVENT_REGISTRATION_QUESTIONS: EventRegistrationQuestion[] = [
  {
    id: 'q-bluewater-experience',
    event_id: 'evt-bluewater-boston-provincetown',
    question_text: 'How many offshore miles have you logged in the past year?',
    answer_type: 'text',
    required: true,
    display_order: 1,
  },
  {
    id: 'q-bluewater-role',
    event_id: 'evt-bluewater-boston-provincetown',
    question_text: 'Preferred watch role',
    answer_type: 'select',
    options: ['Helm', 'Navigation', 'Sail trim', 'Galley / support'],
    required: true,
    display_order: 2,
  },
  {
    id: 'q-bluewater-dietary',
    event_id: 'evt-bluewater-boston-provincetown',
    question_text: 'Any dietary restrictions?',
    answer_type: 'text',
    required: false,
    display_order: 3,
  },
  {
    id: 'q-lts-ai-shirt',
    event_id: 'evt-lts-allinone',
    question_text: 'T-shirt size (included with course fee)',
    answer_type: 'select',
    options: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    required: true,
    display_order: 1,
  },
  {
    id: 'q-lts-ai-photo',
    event_id: 'evt-lts-allinone',
    question_text: 'OK to use your photo for MITNA promotion?',
    answer_type: 'checkbox',
    required: false,
    display_order: 2,
  },
  {
    id: 'q-overnight-rating',
    event_id: 'evt-overnight-series',
    question_text: 'Current sailing rating',
    answer_type: 'select',
    options: ['Provisional', 'Green', 'Orange', 'Red (skipper)'],
    required: true,
    display_order: 1,
  },
  {
    id: 'q-spring-gm-dietary',
    event_id: 'evt-mitna-spring-meeting',
    question_text: 'Pizza preference',
    answer_type: 'select',
    options: ['Cheese', 'Pepperoni', 'Vegetarian', 'Vegan', 'Gluten-free'],
    required: false,
    display_order: 1,
  },
];

/* -------------------------------------------------------------------------- */
/* Event entry fees — scoped to events only (not membership dues, etc.).       */
/* -------------------------------------------------------------------------- */

export const EVENT_ENTRY_FEES: EventEntryFee[] = [
  {
    id: 'fee-dinghy-entry',
    event_id: 'evt-dinghy-cup',
    description: 'Regatta entry',
    amount_cents: 7500,
    is_deposit: false,
  },
  {
    id: 'fee-lts-ai-course',
    event_id: 'evt-lts-allinone',
    description: 'Course fee (includes t-shirt)',
    amount_cents: 15_000,
    is_deposit: false,
  },
  {
    id: 'fee-bluewater-course',
    event_id: 'evt-bluewater-boston-provincetown',
    description: 'Passage fee',
    amount_cents: 42_500,
    is_deposit: false,
  },
  {
    id: 'fee-bluewater-deposit',
    event_id: 'evt-bluewater-boston-provincetown',
    description: 'Refundable provisioning deposit',
    amount_cents: 10_000,
    is_deposit: true,
  },
];

/* -------------------------------------------------------------------------- */
/* Event registrations — per-user RSVPs with approval state.                   */
/* -------------------------------------------------------------------------- */

/**
 * Raw seed rows — `swim_agreement_accepted_at` is derived below from
 * `created_at`, reflecting the policy that every historical registration was
 * captured with a swim-agreement acknowledgement at the time of signup.
 */
const RAW_EVENT_REGISTRATIONS: Omit<
  EventRegistration,
  'swim_agreement_accepted_at'
>[] = [
  /* Bluewater — approval required, mix of states */
  {
    id: 'reg-bw-username',
    event_id: 'evt-bluewater-boston-provincetown',
    user_id: 'username',
    status: 'pending',
    created_at: '2026-04-05T14:30:00.000Z',
  },
  {
    id: 'reg-bw-jchen',
    event_id: 'evt-bluewater-boston-provincetown',
    user_id: 'user-jchen',
    status: 'approved',
    created_at: '2026-04-02T09:15:00.000Z',
  },
  {
    id: 'reg-bw-spark',
    event_id: 'evt-bluewater-boston-provincetown',
    user_id: 'user-spark',
    status: 'approved',
    created_at: '2026-04-03T11:20:00.000Z',
  },
  {
    id: 'reg-bw-rstein',
    event_id: 'evt-bluewater-boston-provincetown',
    user_id: 'user-rstein',
    status: 'pending',
    created_at: '2026-04-06T08:00:00.000Z',
  },
  {
    id: 'reg-bw-dnguyen',
    event_id: 'evt-bluewater-boston-provincetown',
    user_id: 'user-dnguyen',
    status: 'cancelled',
    created_at: '2026-04-01T16:45:00.000Z',
  },
  /* Moonlight — auto-approved */
  {
    id: 'reg-moon-jchen',
    event_id: 'evt-moonlight-july',
    user_id: 'user-jchen',
    status: 'approved',
    created_at: '2026-06-10T20:00:00.000Z',
  },
  {
    id: 'reg-moon-ehwang',
    event_id: 'evt-moonlight-july',
    user_id: 'user-ehwang',
    status: 'approved',
    created_at: '2026-06-11T12:30:00.000Z',
  },
  {
    id: 'reg-moon-pwilson',
    event_id: 'evt-moonlight-july',
    user_id: 'user-pwilson',
    status: 'approved',
    created_at: '2026-06-11T13:00:00.000Z',
  },
  /* MITNA Spring GM — auto-approved */
  {
    id: 'reg-gm-jchen',
    event_id: 'evt-mitna-spring-meeting',
    user_id: 'user-jchen',
    status: 'approved',
    created_at: '2026-02-20T10:00:00.000Z',
  },
  {
    id: 'reg-gm-spark',
    event_id: 'evt-mitna-spring-meeting',
    user_id: 'user-spark',
    status: 'approved',
    created_at: '2026-02-21T14:15:00.000Z',
  },
  {
    id: 'reg-gm-rstein',
    event_id: 'evt-mitna-spring-meeting',
    user_id: 'user-rstein',
    status: 'approved',
    created_at: '2026-02-22T09:45:00.000Z',
  },
  {
    id: 'reg-gm-pwilson',
    event_id: 'evt-mitna-spring-meeting',
    user_id: 'user-pwilson',
    status: 'approved',
    created_at: '2026-02-25T18:20:00.000Z',
  },
  /* Learn-to-Sail All-in-One — auto-approved */
  {
    id: 'reg-ltsai-ehwang',
    event_id: 'evt-lts-allinone',
    user_id: 'user-ehwang',
    status: 'approved',
    created_at: '2026-03-03T12:00:00.000Z',
  },
  {
    id: 'reg-ltsai-dnguyen',
    event_id: 'evt-lts-allinone',
    user_id: 'user-dnguyen',
    status: 'approved',
    created_at: '2026-03-05T08:30:00.000Z',
  },
  /* Overnight Series — approval required */
  {
    id: 'reg-overnight-jchen',
    event_id: 'evt-overnight-series',
    user_id: 'user-jchen',
    status: 'approved',
    created_at: '2026-04-09T10:00:00.000Z',
  },
  {
    id: 'reg-overnight-pwilson',
    event_id: 'evt-overnight-series',
    user_id: 'user-pwilson',
    status: 'pending',
    created_at: '2026-04-12T13:00:00.000Z',
  },
  /* Learn-to-Sail Class 1-2-3, Apr 7-9 cohort (auto-approved) */
  {
    id: 'reg-ltswd-a7-jchen',
    event_id: 'evt-lts-weekday-apr-7',
    user_id: 'user-jchen',
    status: 'approved',
    created_at: '2026-03-16T10:00:00.000Z',
  },
  {
    id: 'reg-ltswd-a7-ehwang',
    event_id: 'evt-lts-weekday-apr-7',
    user_id: 'user-ehwang',
    status: 'approved',
    created_at: '2026-03-17T14:25:00.000Z',
  },
  {
    id: 'reg-ltswd-a7-dnguyen',
    event_id: 'evt-lts-weekday-apr-7',
    user_id: 'user-dnguyen',
    status: 'cancelled',
    created_at: '2026-03-18T08:10:00.000Z',
  },
  /* Learn-to-Sail Class 1-2-3, Apr 14-16 cohort */
  {
    id: 'reg-ltswd-a14-spark',
    event_id: 'evt-lts-weekday-apr-14',
    user_id: 'user-spark',
    status: 'approved',
    created_at: '2026-03-25T09:00:00.000Z',
  },
  {
    id: 'reg-ltswd-a14-rstein',
    event_id: 'evt-lts-weekday-apr-14',
    user_id: 'user-rstein',
    status: 'approved',
    created_at: '2026-03-26T12:30:00.000Z',
  },
];

export const EVENT_REGISTRATIONS: EventRegistration[] =
  RAW_EVENT_REGISTRATIONS.map((r) => ({
    ...r,
    swim_agreement_accepted_at: r.created_at,
  }));

/* -------------------------------------------------------------------------- */
/* Event registration answers — custom question responses per registration.    */
/* -------------------------------------------------------------------------- */

export const EVENT_REGISTRATION_ANSWERS: EventRegistrationAnswer[] = [
  /* Bluewater answers */
  {
    id: 'ra-bw-jchen-exp',
    registration_id: 'reg-bw-jchen',
    question_id: 'q-bluewater-experience',
    value: '420 offshore miles (two Bermuda 1-2 deliveries)',
  },
  {
    id: 'ra-bw-jchen-role',
    registration_id: 'reg-bw-jchen',
    question_id: 'q-bluewater-role',
    value: 'Navigation',
  },
  {
    id: 'ra-bw-spark-exp',
    registration_id: 'reg-bw-spark',
    question_id: 'q-bluewater-experience',
    value: '180 miles across last season',
  },
  {
    id: 'ra-bw-spark-role',
    registration_id: 'reg-bw-spark',
    question_id: 'q-bluewater-role',
    value: 'Sail trim',
  },
  /* Learn-to-Sail All-in-One answers */
  {
    id: 'ra-ltsai-ehwang-shirt',
    registration_id: 'reg-ltsai-ehwang',
    question_id: 'q-lts-ai-shirt',
    value: 'M',
  },
  {
    id: 'ra-ltsai-ehwang-photo',
    registration_id: 'reg-ltsai-ehwang',
    question_id: 'q-lts-ai-photo',
    value: 'yes',
  },
  {
    id: 'ra-ltsai-dnguyen-shirt',
    registration_id: 'reg-ltsai-dnguyen',
    question_id: 'q-lts-ai-shirt',
    value: 'L',
  },
];

/* -------------------------------------------------------------------------- */
/* Event comments — threaded discussion (1-level deep).                        */
/* -------------------------------------------------------------------------- */

export const EVENT_COMMENTS: EventComment[] = [
  {
    id: 'cmt-bw-1',
    event_id: 'evt-bluewater-boston-provincetown',
    parent_id: null,
    user_id: 'user-jchen',
    body: 'Any recommendation on foul-weather gear brands? Debating between Musto and Gill for the overnight leg.',
    created_at: '2026-04-04T18:00:00.000Z',
  },
  {
    id: 'cmt-bw-2',
    event_id: 'evt-bluewater-boston-provincetown',
    parent_id: 'cmt-bw-1',
    user_id: 'user-tbarros',
    body: "Either is fine. Main thing is full bib + jacket rated for offshore. We'll do a gear check the Friday before.",
    created_at: '2026-04-04T19:15:00.000Z',
  },
  {
    id: 'cmt-bw-3',
    event_id: 'evt-bluewater-boston-provincetown',
    parent_id: null,
    user_id: 'user-spark',
    body: 'Will we finalize watch rotations before departure or on the first leg?',
    created_at: '2026-04-05T09:30:00.000Z',
  },
  {
    id: 'cmt-bw-4',
    event_id: 'evt-bluewater-boston-provincetown',
    parent_id: 'cmt-bw-3',
    user_id: 'user-fritz',
    body: "Rotations posted at the dock the morning of departure — we'll confirm once the final crew list is approved.",
    created_at: '2026-04-05T11:00:00.000Z',
  },
  {
    id: 'cmt-gm-1',
    event_id: 'evt-mitna-spring-meeting',
    parent_id: null,
    user_id: 'user-pwilson',
    body: 'Will the budget slides be shared in advance?',
    created_at: '2026-02-26T12:00:00.000Z',
  },
  {
    id: 'cmt-gm-2',
    event_id: 'evt-mitna-spring-meeting',
    parent_id: 'cmt-gm-1',
    user_id: 'user-tbarros',
    body: "Yes — I'll post them to the MITNA Meetings page the day before.",
    created_at: '2026-02-26T14:45:00.000Z',
  },
];

/* -------------------------------------------------------------------------- */
/* Helpers.                                                                    */
/* -------------------------------------------------------------------------- */

function eventOverlapsNyRange(
  ed: EventDate,
  rangeStartKey: string,
  rangeEndKey: string
): boolean {
  const s = nyYmd(new Date(ed.start_datetime));
  const e = nyYmd(new Date(ed.end_datetime));
  return !(e < rangeStartKey || s > rangeEndKey);
}

/** Event rows whose NY span overlaps `[rangeStartKey, rangeEndKey]` (inclusive). */
export function getEventDatesOverlappingNyRange(
  rangeStartKey: string,
  rangeEndKey: string
): EventDate[] {
  return GLOBAL_EVENT_DATES.filter((ed) =>
    eventOverlapsNyRange(ed, rangeStartKey, rangeEndKey)
  );
}

/** NY month range that contains at least part of every catalog row (for navigation). */
export function getEventCatalogMonthBounds(): {
  minYear: number;
  minMonth: number;
  maxYear: number;
  maxMonth: number;
} {
  let minKey = '9999-12-31';
  let maxKey = '0000-01-01';
  for (const ed of GLOBAL_EVENT_DATES) {
    const s = nyYmd(new Date(ed.start_datetime));
    const e = nyYmd(new Date(ed.end_datetime));
    if (s < minKey) {
      minKey = s;
    }
    if (e > maxKey) {
      maxKey = e;
    }
  }
  if (GLOBAL_EVENT_DATES.length === 0) {
    const today = nyYmd(new Date());
    minKey = today;
    maxKey = today;
  }
  const minParts = ymdToYearMonth(minKey);
  const maxParts = ymdToYearMonth(maxKey);
  return {
    minYear: minParts.year,
    minMonth: minParts.month,
    maxYear: maxParts.year,
    maxMonth: maxParts.month,
  };
}

/**
 * Event date rows overlapping the next 7 NY calendar days from `reference`
 * (for the home “Upcoming events” strip).
 */
export function buildEventDates(reference: Date = new Date()): EventDate[] {
  const todayKey = nyYmd(reference);
  const endKey = addNyCalendarDays(todayKey, 6);
  return getEventDatesOverlappingNyRange(todayKey, endKey);
}

export function getEventBySlug(slug: string): Event | undefined {
  return EVENTS.find((e) => e.slug === slug);
}

export function getEventById(id: string): Event | undefined {
  return EVENTS.find((e) => e.id === id);
}

export function getEventCategoryById(id: string): EventCategory | undefined {
  return EVENT_CATEGORIES.find((c) => c.id === id);
}

export function getEventDatesForEvent(eventId: string): EventDate[] {
  return GLOBAL_EVENT_DATES.filter((ed) => ed.eventId === eventId);
}

export function getEventAdminsForEvent(eventId: string): EventAdmin[] {
  return EVENT_ADMINS.filter((a) => a.event_id === eventId);
}

export function getEventRegistrationsForEvent(
  eventId: string
): EventRegistration[] {
  return EVENT_REGISTRATIONS.filter((r) => r.event_id === eventId);
}

export function getEventRegistrationQuestionsForEvent(
  eventId: string
): EventRegistrationQuestion[] {
  return EVENT_REGISTRATION_QUESTIONS.filter(
    (q) => q.event_id === eventId
  ).toSorted((a, b) => a.display_order - b.display_order);
}

export function getEventEntryFeesForEvent(eventId: string): EventEntryFee[] {
  return EVENT_ENTRY_FEES.filter((f) => f.event_id === eventId);
}

export function getEventCommentsForEvent(eventId: string): EventComment[] {
  return EVENT_COMMENTS.filter((c) => c.event_id === eventId);
}
