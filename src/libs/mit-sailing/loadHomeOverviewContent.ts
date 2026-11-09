import 'server-only';
import { cache } from 'react';
import { logger } from '@/libs/Logger';
import {
  CMS_HOME_OVERVIEW_MAX_EVENTS,
  CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS,
  CMS_HOME_OVERVIEW_MAX_STEPS,
} from '@/libs/mit-sailing/cmsHomeOverview';
import type { CmsHomeOverviewData } from '@/libs/mit-sailing/cmsHomeOverview';
import { safeCmsHref } from '@/libs/mit-sailing/cmsHref';
import { ensureHomeOverviewContentSeedSafely } from '@/libs/mit-sailing/seedHomeOverviewContent';
import { getPayloadClient } from '@/libs/payload/getPayloadClient';
import { homeOverviewGlobalSeedData } from '@/payload/globals/homeOverviewSeed';

export type HomeOverviewContent = CmsHomeOverviewData & {
  title: string;
  subtitle?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fieldString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function contentFromSeed(
  seed: ReturnType<typeof homeOverviewGlobalSeedData>
): HomeOverviewContent {
  return {
    title: seed.title,
    subtitle: seed.subtitle,
    hoursNote: seed.hoursNote,
    schedule: seed.schedule,
    stepsTitle: seed.stepsTitle,
    steps: seed.steps,
    eventsTitle: seed.eventsTitle,
    eventCount: seed.eventCount,
    eventsEmptyText: seed.eventsEmptyText,
    eventsCtaLabel: seed.eventsCtaLabel,
    eventsCtaUrl: seed.eventsCtaUrl,
  };
}

function homeOverviewScheduleFromGlobal(
  value: Record<string, unknown>
): HomeOverviewContent['schedule'] | null {
  const scheduleRaw = Array.isArray(value.schedule) ? value.schedule : [];
  const schedule = scheduleRaw.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }
    const day = fieldString(row, 'day');
    const hours = fieldString(row, 'hours');
    if (day.length === 0 || hours.length === 0) {
      return [];
    }
    return [{ day, hours }];
  });
  if (
    schedule.length < 1 ||
    schedule.length > CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS
  ) {
    return null;
  }
  return schedule;
}

function homeOverviewStepsFromGlobal(
  value: Record<string, unknown>
): HomeOverviewContent['steps'] | null {
  const stepsRaw = Array.isArray(value.steps) ? value.steps : [];
  const steps = stepsRaw.flatMap((row) => {
    if (!isRecord(row)) {
      return [];
    }
    const stepTitle = fieldString(row, 'title');
    const description = fieldString(row, 'description');
    if (stepTitle.length === 0 || description.length === 0) {
      return [];
    }
    return [{ title: stepTitle, description }];
  });
  if (steps.length < 1 || steps.length > CMS_HOME_OVERVIEW_MAX_STEPS) {
    return null;
  }
  return steps;
}

function contentFromGlobal(value: unknown): HomeOverviewContent | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = fieldString(value, 'title');
  const stepsTitle = fieldString(value, 'stepsTitle');
  const eventsTitle = fieldString(value, 'eventsTitle');
  const eventsEmptyText =
    typeof value.eventsEmptyText === 'string'
      ? value.eventsEmptyText.trim()
      : '';
  const eventsCtaLabel = fieldString(value, 'eventsCtaLabel');
  const eventsCtaUrl = fieldString(value, 'eventsCtaUrl');
  const eventCountRaw = value.eventCount;
  let eventCount = Number.NaN;
  if (typeof eventCountRaw === 'number' && Number.isInteger(eventCountRaw)) {
    eventCount = eventCountRaw;
  } else if (typeof eventCountRaw === 'string') {
    eventCount = Number.parseInt(eventCountRaw, 10);
  }

  if (
    title.length === 0 ||
    stepsTitle.length === 0 ||
    eventsTitle.length === 0 ||
    eventsCtaLabel.length === 0 ||
    !safeCmsHref(eventsCtaUrl) ||
    !Number.isInteger(eventCount) ||
    eventCount < 1 ||
    eventCount > CMS_HOME_OVERVIEW_MAX_EVENTS
  ) {
    return null;
  }

  const schedule = homeOverviewScheduleFromGlobal(value);
  const steps = homeOverviewStepsFromGlobal(value);
  if (!schedule || !steps) {
    return null;
  }

  const subtitle = fieldString(value, 'subtitle');
  const hoursNote = fieldString(value, 'hoursNote');

  return {
    title,
    subtitle: subtitle.length > 0 ? subtitle : undefined,
    hoursNote: hoursNote.length > 0 ? hoursNote : undefined,
    schedule,
    stepsTitle,
    steps,
    eventsTitle,
    eventCount,
    eventsEmptyText,
    eventsCtaLabel,
    eventsCtaUrl,
  };
}

async function loadHomeOverviewContentUnchecked(): Promise<HomeOverviewContent> {
  await ensureHomeOverviewContentSeedSafely();
  try {
    const payload = await getPayloadClient();
    const global = await payload.findGlobal({
      overrideAccess: false,
      slug: 'home-overview',
    });
    const parsed = contentFromGlobal(global);
    if (parsed) {
      return parsed;
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to load home overview content: ${message}`);
  }
  return contentFromSeed(homeOverviewGlobalSeedData());
}

/**
 * Loads editable homepage overview copy from the Payload global.
 */
export const loadHomeOverviewContent = cache(loadHomeOverviewContentUnchecked);
