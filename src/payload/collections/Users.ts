import type { CollectionConfig } from 'payload';
import { Role, ROLE_VALUES } from '@/libs/auth/roles';
import { authenticatedCmsAccess } from '@/payload/access';
import { betterAuthStrategy } from '@/payload/auth/betterAuthStrategy';

/**
 * Payload auth collection bridged to Better Auth. Local email/password is off;
 * staff sessions are resolved by {@link betterAuthStrategy}.
 */
export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    hidden: true,
    useAsTitle: 'email',
  },
  auth: {
    disableLocalStrategy: true,
    strategies: [betterAuthStrategy],
  },
  access: {
    admin: ({ req }) => Boolean(req.user),
    create: () => false,
    delete: () => false,
    read: authenticatedCmsAccess,
    update: () => false,
  },
  fields: [
    {
      name: 'betterAuthUserId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        update: () => false,
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'appRole',
      type: 'select',
      required: true,
      defaultValue: Role.USER,
      options: ROLE_VALUES.map((value) => ({
        label: value,
        value,
      })),
      access: {
        update: () => false,
      },
    },
  ],
  timestamps: true,
  versions: false,
};
