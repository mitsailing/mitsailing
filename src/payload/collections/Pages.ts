import type { CollectionConfig } from 'payload';
import { authenticatedCmsAccess, cmsEditAccess } from '@/payload/access';

/**
 * Marketing pages with Lexical body, drafts, autosave, versions, and trash.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
    read: authenticatedCmsAccess,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'body',
      type: 'richText',
      required: true,
    },
  ],
  timestamps: true,
  trash: true,
  versions: {
    drafts: {
      autosave: true,
    },
  },
};
