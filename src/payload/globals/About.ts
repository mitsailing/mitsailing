import type { GlobalConfig } from 'payload';
import { cmsEditAccess } from '@/payload/access';

const textRow = {
  name: 'text',
  type: 'textarea',
  required: true,
} as const;

/**
 * Fixed About page copy. Staff cards live in the staff collection.
 */
export const About: GlobalConfig = {
  slug: 'about',
  label: 'About',
  access: {
    read: () => true,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'intro',
      type: 'group',
      label: 'Intro',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'textarea', required: true },
      ],
    },
    {
      name: 'mission',
      type: 'group',
      label: 'Mission',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'textarea', required: true },
        { name: 'pillarsHeading', type: 'text', required: true },
        {
          name: 'paragraphs',
          type: 'array',
          required: true,
          fields: [textRow],
        },
        {
          name: 'pillars',
          type: 'array',
          required: true,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'body', type: 'textarea', required: true },
            { name: 'ctaLabel', type: 'text' },
            { name: 'ctaHref', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'membership',
      type: 'group',
      label: 'Pricing',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'body', type: 'textarea', required: true },
        { name: 'ctaLabel', type: 'text', required: true },
        { name: 'ctaHref', type: 'text', required: true },
        {
          name: 'options',
          type: 'array',
          required: true,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'body', type: 'textarea', required: true },
          ],
        },
      ],
    },
    {
      name: 'history',
      type: 'group',
      label: 'History',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'textarea', required: true },
        {
          name: 'entries',
          type: 'array',
          required: true,
          fields: [
            { name: 'year', type: 'text' },
            { name: 'text', type: 'textarea', required: true },
          ],
        },
        { name: 'supportText', type: 'textarea', required: true },
        { name: 'supportLabel', type: 'text', required: true },
        { name: 'supportHref', type: 'text', required: true },
      ],
    },
    {
      name: 'staffSection',
      type: 'group',
      label: 'Staff section',
      admin: {
        description: 'Headings only. Add and remove people in Staff.',
      },
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'textarea', required: true },
      ],
    },
    {
      name: 'volunteer',
      type: 'group',
      label: 'Volunteer',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'intro', type: 'textarea', required: true },
        {
          name: 'sections',
          type: 'array',
          required: true,
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'body', type: 'textarea', required: true },
            {
              name: 'bullets',
              type: 'array',
              fields: [{ name: 'text', type: 'text', required: true }],
            },
            { name: 'footnote', type: 'textarea' },
          ],
        },
        {
          name: 'links',
          type: 'array',
          required: true,
          fields: [
            { name: 'label', type: 'text', required: true },
            { name: 'href', type: 'text', required: true },
          ],
        },
      ],
    },
    {
      name: 'dockHours',
      type: 'group',
      label: 'Dock hours',
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'textarea', required: true },
        { name: 'lead', type: 'textarea', required: true },
        { name: 'disclaimer', type: 'textarea', required: true },
        { name: 'helmsman', type: 'textarea', required: true },
      ],
    },
  ],
};
