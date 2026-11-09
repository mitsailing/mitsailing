import type { CollectionConfig } from 'payload';
import { cmsEditAccess, publishedPagesReadAccess } from '@/payload/access';

function publicPathFromSlug(slug: unknown): string | null {
  if (typeof slug !== 'string') {
    return null;
  }
  const trimmed = slug.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

/**
 * Marketing pages with Lexical body, drafts, autosave, versions, and trash.
 */
export const Pages: CollectionConfig = {
  slug: 'pages',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug', '_status', 'updatedAt'],
    preview: (doc) => publicPathFromSlug(doc.slug),
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
    read: publishedPagesReadAccess,
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
