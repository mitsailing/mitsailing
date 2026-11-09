import path from 'node:path';
import type { CollectionConfig, TextFieldValidation } from 'payload';
import { Env } from '@/libs/Env';
import { cmsEditAccess } from '@/payload/access';

const MEDIA_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

function mediaStaticDir() {
  return path.isAbsolute(Env.MEDIA_STORAGE_ROOT)
    ? Env.MEDIA_STORAGE_ROOT
    : path.resolve(process.cwd(), Env.MEDIA_STORAGE_ROOT);
}

/**
 * Local uploads into the existing cms-media volume. No SVG, no remote storage.
 */
export const Media: CollectionConfig = {
  slug: 'media',
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'mimeType', 'updatedAt'],
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
    // Public pages render these files. The file route enforces this read access.
    read: () => true,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: false,
      validate: ((value, { data }) => {
        const mimeType =
          data && typeof data === 'object' && 'mimeType' in data
            ? data.mimeType
            : undefined;
        if (
          typeof mimeType === 'string' &&
          mimeType.startsWith('image/') &&
          (typeof value !== 'string' || value.trim().length === 0)
        ) {
          return 'Alt text is required for images.';
        }
        return true;
      }) satisfies TextFieldValidation,
    },
  ],
  upload: {
    staticDir: mediaStaticDir(),
    mimeTypes: [...MEDIA_MIME_TYPES],
    adminThumbnail: 'thumbnail',
    imageSizes: [
      {
        name: 'thumbnail',
        width: 400,
        height: undefined,
        position: 'centre',
      },
    ],
  },
  timestamps: true,
  versions: false,
};

export const MEDIA_MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_BYTES;
