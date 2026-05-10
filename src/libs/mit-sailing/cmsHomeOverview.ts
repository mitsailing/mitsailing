export const CMS_HOME_OVERVIEW_MAX_EVENTS = 12;
export const CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS = 14;
export const CMS_HOME_OVERVIEW_MAX_STEPS = 6;

export type CmsHomeOverviewScheduleRow = {
  day: string;
  hours: string;
};

export type CmsHomeOverviewStep = {
  title: string;
  description: string;
};

export type CmsHomeOverviewData = {
  hoursNote?: string;
  schedule: CmsHomeOverviewScheduleRow[];
  stepsTitle: string;
  steps: CmsHomeOverviewStep[];
  eventsTitle: string;
  eventCount: number;
  eventsEmptyText: string;
  eventsCtaLabel: string;
  eventsCtaUrl: string;
};

function propertyFromUnknown(value: unknown, key: string): unknown {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.getOwnPropertyDescriptor(value, key)?.value;
  }
  return undefined;
}

function stringFromUnknown(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function textFromUnknown(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function integerFromUnknown(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function scheduleRowFromUnknown(
  value: unknown
): CmsHomeOverviewScheduleRow | null {
  const day = stringFromUnknown(propertyFromUnknown(value, 'day'));
  const hours = stringFromUnknown(propertyFromUnknown(value, 'hours'));
  if (!day || !hours) {
    return null;
  }
  return { day, hours };
}

function stepFromUnknown(value: unknown): CmsHomeOverviewStep | null {
  const title = stringFromUnknown(propertyFromUnknown(value, 'title'));
  const description = stringFromUnknown(
    propertyFromUnknown(value, 'description')
  );
  if (!title || !description) {
    return null;
  }
  return { title, description };
}

function scheduleRowsFromUnknown(value: unknown): CmsHomeOverviewScheduleRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const row = scheduleRowFromUnknown(item);
    return row ? [row] : [];
  });
}

function stepsFromUnknown(value: unknown): CmsHomeOverviewStep[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    const step = stepFromUnknown(item);
    return step ? [step] : [];
  });
}

/**
 * Parses the structured home overview CMS block body.
 *
 * @param body - JSON CMS block body
 * @returns Home overview data when all required panels are valid
 */
export function parseCmsHomeOverviewBody(
  body: string | undefined
): CmsHomeOverviewData | null {
  if (!body) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }

  const schedule = scheduleRowsFromUnknown(
    propertyFromUnknown(parsed, 'schedule')
  );
  const steps = stepsFromUnknown(propertyFromUnknown(parsed, 'steps'));
  const eventCount =
    integerFromUnknown(propertyFromUnknown(parsed, 'eventCount')) ?? 4;
  const stepsTitle = stringFromUnknown(
    propertyFromUnknown(parsed, 'stepsTitle')
  );
  const eventsTitle = stringFromUnknown(
    propertyFromUnknown(parsed, 'eventsTitle')
  );
  const eventsEmptyText = textFromUnknown(
    propertyFromUnknown(parsed, 'eventsEmptyText')
  );
  const eventsCtaLabel = stringFromUnknown(
    propertyFromUnknown(parsed, 'eventsCtaLabel')
  );
  const eventsCtaUrl = stringFromUnknown(
    propertyFromUnknown(parsed, 'eventsCtaUrl')
  );

  if (
    schedule.length < 1 ||
    schedule.length > CMS_HOME_OVERVIEW_MAX_SCHEDULE_ROWS ||
    steps.length < 1 ||
    steps.length > CMS_HOME_OVERVIEW_MAX_STEPS ||
    eventCount < 1 ||
    eventCount > CMS_HOME_OVERVIEW_MAX_EVENTS ||
    !stepsTitle ||
    !eventsTitle ||
    eventsEmptyText === undefined ||
    !eventsCtaLabel ||
    !eventsCtaUrl
  ) {
    return null;
  }

  return {
    hoursNote: stringFromUnknown(propertyFromUnknown(parsed, 'hoursNote')),
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

export function serializeCmsHomeOverviewBody(
  data: CmsHomeOverviewData
): string {
  return JSON.stringify(data, null, 2);
}
