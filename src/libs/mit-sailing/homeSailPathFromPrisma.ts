import 'server-only';
import { LearnToSailWaitlistEntryStatus } from '@/generated/prisma/enums';
import { getCurrentUser } from '@/libs/auth/dal';
import { prisma } from '@/libs/DB';
import {
  deriveHomeSailPathExperiencedSchedule,
  formatHomeSailPathExperiencedSession,
  homeSailPathExperiencedEventName,
} from '@/libs/mit-sailing/homeSailPathSchedule';
import type {
  HomeSailPathExperiencedSession,
  HomeSailPathScheduleSummary,
  HomeSailPathWaitlistState,
} from '@/libs/mit-sailing/homeSailPathSchedule';
import {
  getLearnToSailSeasonYear,
  isLearnToSailWaitlistOpen,
} from '@/libs/mit-sailing/learnToSailWaitlist';

const MAX_EXPERIENCED_SESSIONS = 12;

export type HomeSailPathData = {
  readonly experiencedSessions: readonly HomeSailPathExperiencedSession[];
  readonly scheduleSummary: HomeSailPathScheduleSummary | null;
  readonly waitlist: HomeSailPathWaitlistState;
};

async function loadExperiencedSessions(now: Date): Promise<{
  readonly sessions: HomeSailPathExperiencedSession[];
  readonly scheduleSummary: HomeSailPathScheduleSummary | null;
}> {
  const rows = await prisma.eventDate.findMany({
    where: {
      startDateTime: { gte: now },
      event: {
        isPublished: true,
        name: {
          equals: homeSailPathExperiencedEventName(),
          mode: 'insensitive',
        },
      },
    },
    orderBy: { startDateTime: 'asc' },
    take: MAX_EXPERIENCED_SESSIONS,
    select: {
      id: true,
      startDateTime: true,
      endDateTime: true,
      event: { select: { slug: true } },
    },
  });

  return {
    sessions: rows.map((row) =>
      formatHomeSailPathExperiencedSession({
        eventSlug: row.event.slug,
        id: row.id,
        startDateTime: row.startDateTime,
      })
    ),
    scheduleSummary: deriveHomeSailPathExperiencedSchedule(rows),
  };
}

async function loadWaitlistState(
  now: Date
): Promise<HomeSailPathWaitlistState> {
  const user = await getCurrentUser();
  if (!user) {
    return { kind: 'anonymous' };
  }

  const entry = await prisma.learnToSailWaitlistEntry.findFirst({
    orderBy: { sequence: 'asc' },
    select: { sequence: true },
    where: {
      seasonYear: getLearnToSailSeasonYear(now),
      status: LearnToSailWaitlistEntryStatus.active,
      userId: user.id,
    },
  });

  if (entry) {
    return { kind: 'position', position: entry.sequence };
  }

  if (!isLearnToSailWaitlistOpen(now)) {
    return { kind: 'closed' };
  }

  return { kind: 'join' };
}

/**
 * Server data for the homepage sail-path fork: upcoming orientations and
 * Learn-to-Sail waitlist CTA state for the current viewer.
 *
 * @returns Serializable props for {@link HomeSailPath}
 */
export async function loadHomeSailPathData(): Promise<HomeSailPathData> {
  const now = new Date();
  const [experienced, waitlist] = await Promise.all([
    loadExperiencedSessions(now),
    loadWaitlistState(now),
  ]);

  return {
    experiencedSessions: experienced.sessions,
    scheduleSummary: experienced.scheduleSummary,
    waitlist,
  };
}
