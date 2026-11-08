import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { postgresAdapter } from '@payloadcms/db-postgres';
import { redirectsPlugin } from '@payloadcms/plugin-redirects';
import { sentryPlugin } from '@payloadcms/plugin-sentry';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
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
  Pages,
  Users,
} from '@/payload/collections';
import { MEDIA_MAX_FILE_SIZE_BYTES } from '@/payload/collections/Media';

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
  collections: [Users, Media, Pages, Menus, ClassCategories, Classes, Boats],
  db: postgresAdapter({
    pool: {
      connectionString: Env.DATABASE_URL,
      max: 5,
    },
    push: false,
    schemaName: 'payload',
  }),
  editor: lexicalEditor(),
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
