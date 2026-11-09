import type { CollectionConfig } from 'payload';
import { appOrigin } from '@/libs/payload/appOrigin';
import { payloadPreviewSecret } from '@/libs/payload/previewSecret';
import { cmsEditAccess, publishedPagesReadAccess } from '@/payload/access';
import {
  CallToAction,
  Content,
  MediaBlock,
  MediaContent,
} from '@/payload/blocks/pageLayout';

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
    livePreview: {
      url: ({ data }) => {
        const path = publicPathFromSlug(data.slug);
        if (!path) {
          return null;
        }
        return `${appOrigin()}${path}`;
      },
    },
    preview: (doc) => {
      const path = publicPathFromSlug(doc.slug);
      if (!path) {
        return null;
      }
      const params = new URLSearchParams({
        path,
        previewSecret: payloadPreviewSecret(),
      });
      return `${appOrigin()}/next/preview?${params.toString()}`;
    },
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
    {
      name: 'layout',
      type: 'blocks',
      label: 'Layout',
      admin: {
        description:
          'Optional sections. When this is empty, the page shows its body.',
        initCollapsed: true,
      },
      blocks: [MediaContent, Content, MediaBlock, CallToAction],
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
