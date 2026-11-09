import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { redirectsPlugin } from '@payloadcms/plugin-redirects';
import { sentryPlugin } from '@payloadcms/plugin-sentry';
import {
  FixedToolbarFeature,
  HeadingFeature,
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
const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: Users.slug,
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
    // Local dev uses Payload's default schema push. Production never pushes;
    // NODE_ENV=production skips it. Production still needs payload migrations.
    schemaName: 'payload',
  }),
  editor: lexicalEditor({
    features: ({ defaultFeatures }) => [
      ...defaultFeatures.filter((feature) => feature.key !== 'heading'),
      HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
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
