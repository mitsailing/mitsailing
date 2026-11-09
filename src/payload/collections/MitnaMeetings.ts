import type { CollectionConfig } from 'payload';
import { cmsEditAccess } from '@/payload/access';

/**
 * Dated MITNA meetings and calendar notices shown on `/mitna/meetings`.
 */
export const MitnaMeetings: CollectionConfig = {
  slug: 'mitna-meetings',
  labels: {
    singular: 'MITNA meeting',
    plural: 'MITNA meetings',
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'date', 'updatedAt'],
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
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
      name: 'date',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayOnly',
          displayFormat: 'yyyy-MM-dd',
        },
      },
    },
    {
      name: 'link',
      type: 'text',
      admin: {
        description: 'Optional external or internal URL.',
      },
    },
  ],
  timestamps: true,
  versions: false,
};
