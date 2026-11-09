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
