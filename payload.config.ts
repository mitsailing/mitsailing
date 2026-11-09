import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { redirectsPlugin } from '@payloadcms/plugin-redirects';
import { sentryPlugin } from '@payloadcms/plugin-sentry';
import {
  FixedToolbarFeature,
  HeadingFeature,
  LinkFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical';
import * as Sentry from '@sentry/nextjs';
import { buildConfig } from 'payload';
import sharp from 'sharp';
import { Env } from '@/libs/Env';
import { authenticatedCmsAccess, cmsEditAccess } from '@/payload/access';
import {
  Boats,
  ClassCategories,
  Classes,
  Media,
  Menus,
  MitnaMeetings,
  Pages,
  Staff,
  Users,
} from '@/payload/collections';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '@/payload/collections/Media';
import { About } from '@/payload/globals/About';
import { HomeOverview } from '@/payload/globals/HomeOverview';
import { ImageWrapFeature } from '@/payload/lexical/imageWrapFeature';
import { migrations } from './src/migrations';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

/**
 * Root-relative paths must work on localhost and mitsailing.com.
 * Replace the default URL field so relative hrefs are accepted.
 *
 * @returns Lexical link feature that accepts root-relative URLs
 */
function linkFeatureAllowingRelativeUrls() {
  return LinkFeature({
    fields: ({ defaultFields }) => {
      const withoutUrl = defaultFields.filter(
        (field) => !('name' in field && field.name === 'url')
      );
      return [
        ...withoutUrl,
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_data, siblingData) =>
              siblingData?.linkType !== 'internal',
          },
          label: ({ t }) => t('fields:enterURL'),
          required: true,
          validate: (value: string | null | undefined) => {
            if (typeof value !== 'string' || value.trim().length === 0) {
              return 'Enter a URL';
            }
            if (value.includes(' ')) {
              return 'Invalid URL';
            }
            return true;
          },
        },
      ];
    },
  });
}

export default buildConfig({
  admin: {
    user: Users.slug,
    components: {
      beforeNavLinks: [
        '/payload/admin/PayloadViewSiteLink#PayloadViewSiteLink',
      ],
    },
    importMap: {
      baseDir: path.resolve(dirname, 'src'),
      importMapFile: path.resolve(
        dirname,
        'src/app/(payload)/cms/importMap.js'
      ),
    },
  },
  collections: [
    Users,
    Media,
    Pages,
    Menus,
    ClassCategories,
    Classes,
    Boats,
    Staff,
    MitnaMeetings,
  ],
  globals: [About, HomeOverview],
  db: postgresAdapter({
    pool: {
      connectionString: Env.DATABASE_URL,
      max: 5,
    },
    // Dev keeps Drizzle push. Production runs prodMigrations on connect.
    prodMigrations: migrations,
    schemaName: 'payload',
  }),
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter(
        (feature) => feature.key !== 'heading' && feature.key !== 'link'
      ),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
      linkFeatureAllowingRelativeUrls(),
      ImageWrapFeature(),
      FixedToolbarFeature(),
    ],
  }),
  graphQL: {
    disable: true,
  },
  plugins: [
    redirectsPlugin({
      collections: ['pages'],
      overrides: {
        access: {
          create: cmsEditAccess,
          delete: cmsEditAccess,
          read: authenticatedCmsAccess,
          update: cmsEditAccess,
        },
        versions: false,
      },
    }),
    sentryPlugin({
      Sentry,
    }),
  ],
  routes: {
    admin: '/cms',
    api: '/cms-api',
  },
  secret: Env.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'src/payload/payload-types.ts'),
  },
  upload: {
    limits: {
      fileSize: MEDIA_MAX_FILE_SIZE_BYTES,
    },
  },
});
