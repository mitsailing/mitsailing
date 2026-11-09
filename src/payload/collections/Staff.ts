import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload';
import { cmsEditAccess } from '@/payload/access';

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replaceAll(/^-+|-+$/g, '');
}

const fillStaffSlug: CollectionBeforeValidateHook = ({ data }) => {
  if (!data) {
    return data;
  }
  const slug = typeof data.slug === 'string' ? data.slug.trim() : '';
  const name = typeof data.name === 'string' ? data.name : '';
  if (slug.length > 0 || name.trim().length === 0) {
    return data;
  }
  return {
    ...data,
    slug: slugFromName(name),
  };
};

/**
 * Staff cards on the About page. Short bio and an optional photo only.
 */
export const Staff: CollectionConfig = {
  slug: 'staff',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'role', 'displayOrder'],
    description: 'Name, role, short bio, and an optional photo.',
  },
  access: {
    create: cmsEditAccess,
    delete: cmsEditAccess,
    read: () => true,
    update: cmsEditAccess,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Profile URL, for example hannah-agate.',
      },
    },
    {
      name: 'role',
      type: 'text',
      required: true,
    },
    {
      name: 'bio',
      type: 'textarea',
      admin: {
        description: 'Short card text. No links.',
      },
    },
    {
      name: 'photo',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'displayOrder',
      type: 'number',
      required: true,
      defaultValue: 0,
    },
  ],
  hooks: {
    beforeValidate: [fillStaffSlug],
  },
  timestamps: true,
  versions: false,
};
