import type { GlobalConfig } from 'payload';
import { cmsEditAccess } from '@/payload/access';

/**
 * Homepage pavilion hours, getting-started steps, and events-panel wording.
 */
export const HomeOverview: GlobalConfig = {
  slug: 'home-overview',
  label: 'Home overview',
  access: {
    read: () => true,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'subtitle',
      type: 'text',
    },
    {
      name: 'hoursNote',
      type: 'textarea',
    },
    {
      name: 'schedule',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 14,
      fields: [
        { name: 'day', type: 'text', required: true },
        { name: 'hours', type: 'text', required: true },
      ],
    },
    {
      name: 'stepsTitle',
      type: 'text',
      required: true,
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'textarea', required: true },
      ],
    },
    {
      name: 'eventsTitle',
      type: 'text',
      required: true,
    },
    {
      name: 'eventCount',
      type: 'number',
      required: true,
      min: 1,
      max: 12,
      defaultValue: 4,
    },
    {
      name: 'eventsEmptyText',
      type: 'textarea',
      required: true,
    },
    {
      name: 'eventsCtaLabel',
      type: 'text',
      required: true,
    },
    {
      name: 'eventsCtaUrl',
      type: 'text',
      required: true,
    },
  ],
};
